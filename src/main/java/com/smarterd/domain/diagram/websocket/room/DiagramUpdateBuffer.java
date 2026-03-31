package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

/**
 * Yjs update 누적 버퍼와 dirty 상태를 관리하는 내부 저장소.
 */
@Slf4j
final class DiagramUpdateBuffer {

    /** 다이어그램 ID → 누적된 Yjs update 바이트 배열 리스트 */
    private final Map<Long, List<byte[]>> accumulatedUpdates = new ConcurrentHashMap<>();

    /** 다이어그램 ID → 누적 update 총 크기 (바이트) */
    private final Map<Long, AtomicLong> accumulatedSizes = new ConcurrentHashMap<>();

    /** 스냅샷이 변경되었지만 아직 DB에 저장되지 않은 다이어그램 ID 집합 */
    private final Set<Long> dirtyDiagramIds = ConcurrentHashMap.newKeySet();

    /** dirty 집합 복합 연산 동기화 전용 락 */
    private final Object dirtyLock = new Object();

    /**
     * Yjs update를 누적 리스트에 추가한다.
     *
     * @param diagramId      다이어그램 ID
     * @param update         순수 Yjs update 바이트 배열 (타입 바이트 제외)
     * @param maxBufferBytes 허용 최대 누적 바이트 크기
     * @return 추가 성공 여부 (false면 누적 크기 초과)
     */
    boolean appendUpdate(Long diagramId, byte[] update, long maxBufferBytes) {
        final var updates = accumulatedUpdates.computeIfAbsent(diagramId, (k) ->
            Collections.synchronizedList(new ArrayList<>())
        );
        final var sizeCounter = accumulatedSizes.computeIfAbsent(diagramId, (k) -> new AtomicLong(0));

        // sizeCounter와 updates 리스트 상태를 원자적으로 관리하기 위해 updates 락 사용
        // drainAndMergeUpdates()와 동시 실행 시 카운터 불일치 방지
        synchronized (updates) {
            final var newSize = sizeCounter.addAndGet(update.length);
            if (newSize > maxBufferBytes) {
                sizeCounter.addAndGet(-update.length);
                return false;
            }
            updates.add(update);
        }

        synchronized (dirtyLock) {
            dirtyDiagramIds.add(diagramId);
        }
        return true;
    }

    /**
     * 누적된 Yjs update들을 원자적으로 drain(추출 + 비움)하고 단일 바이트 배열로 병합한다.
     * drain 이후 새로 추가되는 update는 새 리스트에 누적된다.
     *
     * @param diagramId 다이어그램 ID
     * @return 병합된 바이트 배열, 누적 데이터가 없으면 빈 배열
     */
    byte[] drainAndMergeUpdates(Long diagramId) {
        final var updates = accumulatedUpdates.get(diagramId);
        if (updates == null || updates.isEmpty()) {
            return new byte[0];
        }

        final List<byte[]> drained;
        synchronized (updates) {
            drained = new ArrayList<>(updates);
            updates.clear();
            // 크기 카운터 리셋: drain~set(0) 사이에 appendUpdate가 끼어드는 것을 방지
            final var sizeCounter = accumulatedSizes.get(diagramId);
            if (sizeCounter != null) {
                sizeCounter.set(0);
            }
        }

        if (drained.isEmpty()) {
            return new byte[0];
        }
        return YjsUpdateFormat.encode(drained);
    }

    /**
     * 현재 누적된 update를 비우지 않고 병합 snapshot 형태로 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 병합된 바이트 배열, 누적 데이터가 없으면 빈 배열
     */
    byte[] peekMergedUpdates(Long diagramId) {
        final var updates = accumulatedUpdates.get(diagramId);
        if (updates == null || updates.isEmpty()) {
            return new byte[0];
        }

        synchronized (updates) {
            if (updates.isEmpty()) {
                return new byte[0];
            }
            return YjsUpdateFormat.encode(new ArrayList<>(updates));
        }
    }

    /**
     * drain된 update를 인메모리 버퍼에 복원한다.
     * flush 또는 컴팩션 실패 시 데이터 유실을 방지하기 위해 호출한다.
     *
     * @param diagramId      다이어그램 ID
     * @param mergedUpdates  drain된 병합 바이트 배열 (null 또는 빈 배열이면 무시)
     * @param maxBufferBytes 허용 최대 누적 바이트 크기
     * @return 복원 성공 여부
     */
    boolean restoreUpdates(Long diagramId, byte[] mergedUpdates, long maxBufferBytes) {
        if (mergedUpdates == null || mergedUpdates.length == 0) {
            return true;
        }

        try {
            final var restoredUpdates = YjsUpdateFormat.decode(mergedUpdates);
            final var updates = accumulatedUpdates.computeIfAbsent(diagramId, (k) ->
                Collections.synchronizedList(new ArrayList<>())
            );
            final var sizeCounter = accumulatedSizes.computeIfAbsent(diagramId, (k) -> new AtomicLong(0));

            long restoreSize = 0;
            for (final var update : restoredUpdates) {
                restoreSize += update.length;
            }

            synchronized (updates) {
                final var currentSize = sizeCounter.get();
                final var newSize = currentSize + restoreSize;

                updates.addAll(restoredUpdates);
                sizeCounter.set(newSize);

                if (newSize > maxBufferBytes) {
                    // 복구 경로에서는 데이터 유실 방지를 우선한다.
                    log.warn(
                        "drain된 update 복원으로 버퍼 상한 초과 (diagramId={}, current={}B, restore={}B, max={}B)",
                        diagramId,
                        currentSize,
                        restoreSize,
                        maxBufferBytes
                    );
                }
            }

            synchronized (dirtyLock) {
                dirtyDiagramIds.add(diagramId);
            }
            log.info("drain된 update {}개 복원 완료 (diagramId={})", restoredUpdates.size(), diagramId);
            return true;
        } catch (RuntimeException e) {
            log.error("drain된 update 복원 중 예외 발생 (diagramId={})", diagramId, e);
            return false;
        }
    }

    /**
     * 다이어그램의 누적 update 버퍼를 단일 update 기준으로 교체한다.
     *
     * 서버가 최신 전체 상태 스냅샷을 이미 확보한 경우, room 버퍼도 같은 상태 기준으로
     * 정렬해 이후 warm handoff/flush가 더 오래된 누적 update로 되돌아가지 않게 한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update 최신 전체 상태를 나타내는 raw Yjs update
     */
    void replaceWithSingleUpdate(Long diagramId, byte[] update) {
        final var updates = accumulatedUpdates.computeIfAbsent(diagramId, (k) ->
            Collections.synchronizedList(new ArrayList<>())
        );
        final var sizeCounter = accumulatedSizes.computeIfAbsent(diagramId, (k) -> new AtomicLong(0));

        synchronized (updates) {
            updates.clear();
            if (update != null && update.length > 0) {
                updates.add(update);
                sizeCounter.set(update.length);
            } else {
                sizeCounter.set(0);
            }
        }

        synchronized (dirtyLock) {
            if (update != null && update.length > 0) {
                dirtyDiagramIds.add(diagramId);
            } else {
                dirtyDiagramIds.remove(diagramId);
            }
        }
    }

    /**
     * 해당 다이어그램에 누적된 update가 있는지 확인한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 누적 update 존재 여부
     */
    boolean hasUpdates(Long diagramId) {
        final var updates = accumulatedUpdates.get(diagramId);
        return updates != null && !updates.isEmpty();
    }

    /**
     * 다이어그램을 다시 dirty 상태로 표시한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void reDirty(Long diagramId) {
        synchronized (dirtyLock) {
            dirtyDiagramIds.add(diagramId);
        }
    }

    /**
     * 변경되었지만 아직 DB에 저장되지 않은 다이어그램 ID를 원자적으로 반환하고 dirty 상태를 초기화한다.
     *
     * @return dirty 다이어그램 ID 집합
     */
    Set<Long> getDirtyIdsAndClear() {
        synchronized (dirtyLock) {
            final var ids = Set.copyOf(dirtyDiagramIds);
            dirtyDiagramIds.clear();
            return ids;
        }
    }

    /**
     * 누적 update가 존재하는 모든 다이어그램 ID를 반환한다.
     *
     * @return 누적 update가 있는 다이어그램 ID 집합
     */
    Set<Long> getAllDiagramIdsWithUpdates() {
        final var ids = ConcurrentHashMap.<Long>newKeySet();
        accumulatedUpdates.forEach((diagramId, updates) -> {
            if (updates != null && !updates.isEmpty()) {
                ids.add(diagramId);
            }
        });
        return ids;
    }

    /**
     * 다이어그램의 누적 버퍼와 dirty 상태를 제거한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void removeDiagram(Long diagramId) {
        accumulatedUpdates.remove(diagramId);
        accumulatedSizes.remove(diagramId);
        synchronized (dirtyLock) {
            dirtyDiagramIds.remove(diagramId);
        }
    }
}
