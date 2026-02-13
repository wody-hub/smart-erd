package com.smarterd.domain.diagram.websocket;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Yjs update 누적 버퍼와 dirty 상태를 관리하는 내부 저장소.
 */
final class DiagramUpdateBuffer {

    private static final Logger log = LoggerFactory.getLogger(DiagramUpdateBuffer.class);

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
        // 누적 크기 체크
        final var sizeCounter = accumulatedSizes.computeIfAbsent(diagramId, (k) -> new AtomicLong(0));
        final var newSize = sizeCounter.addAndGet(update.length);
        if (newSize > maxBufferBytes) {
            sizeCounter.addAndGet(-update.length);
            return false;
        }

        accumulatedUpdates
            .computeIfAbsent(diagramId, (k) -> Collections.synchronizedList(new ArrayList<>()))
            .add(update);
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
     * drain된 update를 인메모리 버퍼에 복원한다.
     * flush 또는 컴팩션 실패 시 데이터 유실을 방지하기 위해 호출한다.
     *
     * @param diagramId      다이어그램 ID
     * @param mergedUpdates  drain된 병합 바이트 배열 (null 또는 빈 배열이면 무시)
     * @param maxBufferBytes 허용 최대 누적 바이트 크기
     */
    void restoreUpdates(Long diagramId, byte[] mergedUpdates, long maxBufferBytes) {
        if (mergedUpdates == null || mergedUpdates.length == 0) {
            return;
        }
        final var updates = YjsUpdateFormat.decode(mergedUpdates);
        for (final var update : updates) {
            appendUpdate(diagramId, update, maxBufferBytes);
        }
        log.info("drain된 update {}개 복원 완료 (diagramId={})", updates.size(), diagramId);
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
