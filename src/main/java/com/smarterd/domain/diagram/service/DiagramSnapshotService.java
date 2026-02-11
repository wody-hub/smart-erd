package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.YjsUpdateFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Y.Doc 스냅샷 저장/로드 전담 서비스.
 *
 * <p>WebSocket 연결 종료 시 또는 주기적으로 인메모리 누적 Yjs update를
 * 기존 DB 스냅샷과 연결하여 저장하고, 새 클라이언트 연결 시 스냅샷을 로드한다.</p>
 *
 * <p>{@link SmartLifecycle}을 구현하여 서버 종료 시 인메모리 누적 update를
 * DB에 안전하게 저장한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class DiagramSnapshotService implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(DiagramSnapshotService.class);

    /** 서버 종료 시 flush 타임아웃 (초) */
    private static final long SHUTDOWN_FLUSH_TIMEOUT_SECONDS = 10;

    /** 누적 update 수 경고 임계치 (초과 시 컴팩션 필요 경고) */
    private static final int COMPACTION_WARN_THRESHOLD = 500;

    /** 컴팩션 크기 허용 비율 (10% 여유) */
    private static final double COMPACTION_SIZE_TOLERANCE = 1.1;

    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;

    /** 방 관리자 (dirty ID 조회 + 누적 update 병합용) */
    private final DiagramRoomManager roomManager;

    /** 다이어그램별 개별 트랜잭션 실행용 (flush 락 안에서 커밋 보장) */
    private final TransactionTemplate transactionTemplate;

    /** SmartLifecycle 실행 상태 */
    private volatile boolean running = false;

    /**
     * 누적된 Yjs update를 기존 DB 스냅샷에 연결하여 저장한다.
     * 마지막 사용자 퇴장 시 호출된다.
     *
     * @param diagramId      다이어그램 ID
     * @param mergedUpdates  병합된 Yjs update 바이트 배열
     */
    @Transactional
    public void saveSnapshotWithUpdates(Long diagramId, byte[] mergedUpdates) {
        final var existingSnapshot = diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]);
        final var combined = combineSnapshotAndUpdates(diagramId, existingSnapshot, mergedUpdates);
        final var updated = diagramRepository.updateYdocSnapshotById(diagramId, combined);
        if (updated == 0) {
            log.warn("스냅샷 저장 실패: 다이어그램 미존재 (id={})", diagramId);
            return;
        }
        log.info("Y.Doc 스냅샷 저장 완료: diagramId={}, size={}bytes", diagramId, combined.length);
    }

    /**
     * DB에서 Y.Doc 스냅샷을 로드한다.
     * 프로젝션 쿼리로 ydocSnapshot만 조회하여 불필요한 content TEXT 로딩을 방지한다.
     *
     * @param diagramId 다이어그램 ID
     * @return Y.Doc 스냅샷 바이트 배열, 없으면 빈 배열
     */
    public byte[] loadSnapshot(Long diagramId) {
        return diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]);
    }

    /**
     * 컴팩션된 스냅샷으로 기존 ydocSnapshot을 교체한다.
     * 크기 비교 검증을 수행하여 컴팩션 결과가 기존보다 큰 경우 거부한다.
     *
     * @param diagramId        다이어그램 ID
     * @param compactedUpdate  클라이언트가 전송한 컴팩션 바이트 (단일 Yjs update)
     * @return 교체 성공 여부
     */
    @Transactional
    public boolean replaceSnapshot(Long diagramId, byte[] compactedUpdate) {
        final var existingSnapshot = diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]);
        final var existingSize = existingSnapshot.length;

        // 단일 update를 YLPF 포맷으로 래핑
        final var compactedSnapshot = YjsUpdateFormat.encode(List.of(compactedUpdate));

        // 크기 비교 검증: 컴팩션 결과가 기존보다 크면 거부
        if (existingSize > 0 && compactedSnapshot.length > existingSize * COMPACTION_SIZE_TOLERANCE) {
            log.warn(
                "컴팩션 거부: 크기 증가 (diagramId={}, existing={}B, compacted={}B)",
                diagramId,
                existingSize,
                compactedSnapshot.length
            );
            return false;
        }

        final var updated = diagramRepository.updateYdocSnapshotById(diagramId, compactedSnapshot);
        if (updated == 0) {
            log.warn("컴팩션 실패: 다이어그램 미존재 (id={})", diagramId);
            return false;
        }

        log.info(
            "Y.Doc 스냅샷 컴팩션 완료: diagramId={}, before={}B, after={}B ({}% 감소)",
            diagramId,
            existingSize,
            compactedSnapshot.length,
            existingSize > 0 ? (100 - (compactedSnapshot.length * 100) / existingSize) : 0
        );
        return true;
    }

    /**
     * 변경된 인메모리 누적 update를 주기적으로 DB에 저장한다.
     *
     * <p>{@code smart-erd.websocket.snapshot-flush-interval} 주기로 실행되며,
     * dirty 플래그가 설정된 다이어그램만 처리한다.
     * 개별 다이어그램 저장 실패 시 해당 ID를 다시 dirty로 표시하여 다음 주기에 재시도한다.</p>
     */
    @Scheduled(fixedDelayString = "${smart-erd.websocket.snapshot-flush-interval:30000}")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void flushDirtySnapshots() {
        final var dirtyIds = roomManager.getDirtyIdsAndClear();
        if (dirtyIds.isEmpty()) {
            return;
        }

        try {
            var savedCount = 0;
            for (final var id : dirtyIds) {
                if (flushSingleDiagram(id)) {
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                log.info("주기적 Y.Doc 스냅샷 저장 완료: {}개 다이어그램", savedCount);
            }
        } catch (Exception e) {
            // 최상위 예외 발생 시 dirty ID 전체를 복구하여 다음 주기에 재시도
            log.error("주기적 스냅샷 저장 중 예외 발생, dirty ID 복구: {}개", dirtyIds.size(), e);
            for (final var id : dirtyIds) {
                roomManager.reDirty(id);
            }
        }
    }

    /**
     * 단일 다이어그램의 누적 update를 DB에 저장한다.
     * flush 락 안에서 트랜잭션 커밋까지 완료하여 락 해제 전에 DB 영속화를 보장한다.
     *
     * @param id 다이어그램 ID
     * @return 저장 성공 여부
     */
    private boolean flushSingleDiagram(Long id) {
        // @Scheduled flush와 연결 종료 flush 간 레이스 방지를 위해 다이어그램별 flush 락 사용
        // TransactionTemplate으로 flush 락 안에서 커밋까지 완료
        synchronized (roomManager.getFlushLock(id)) {
            byte[] mergedUpdates = null;
            try {
                // drain: 원자적으로 누적 update를 추출 + 비움
                mergedUpdates = roomManager.drainAndMergeUpdates(id);
                if (mergedUpdates.length == 0) {
                    return false;
                }

                final var updates = mergedUpdates;
                final var result = transactionTemplate.execute((status) -> {
                    final var existingSnapshot = diagramRepository.findYdocSnapshotById(id).orElse(new byte[0]);
                    final var combined = combineSnapshotAndUpdates(id, existingSnapshot, updates);
                    final var updated = diagramRepository.updateYdocSnapshotById(id, combined);
                    if (updated == 0) {
                        log.warn("주기적 스냅샷 저장 실패: 다이어그램 미존재 (id={})", id);
                        return false;
                    }
                    log.debug("주기적 Y.Doc 스냅샷 저장: diagramId={}, size={}bytes", id, combined.length);
                    return true;
                });
                return Boolean.TRUE.equals(result);
            } catch (Exception e) {
                log.error("주기적 스냅샷 저장 실패 (diagramId={})", id, e);
                // drain 후 DB 저장 실패: drain된 데이터를 개별 update로 디코딩 후 재삽입
                roomManager.restoreUpdates(id, mergedUpdates);
                return false;
            }
        }
    }

    /**
     * 기존 DB 스냅샷과 누적 update를 연결한다.
     *
     * @param diagramId        다이어그램 ID (로그용)
     * @param existingSnapshot 기존 DB 스냅샷 (빈 배열이면 없음)
     * @param mergedUpdates    병합된 Yjs update 바이트
     * @return 기존 스냅샷 + 누적 update를 연결한 바이트 배열
     */
    private byte[] combineSnapshotAndUpdates(Long diagramId, byte[] existingSnapshot, byte[] mergedUpdates) {
        if (existingSnapshot.length == 0) {
            return mergedUpdates;
        }

        if (mergedUpdates.length == 0) {
            return existingSnapshot;
        }

        // 기존 스냅샷(레거시 또는 YLPF)과 새 업데이트를 개별 리스트로 디코딩 후 재인코딩
        final var existingUpdates = YjsUpdateFormat.decode(existingSnapshot);
        final var newUpdates = YjsUpdateFormat.decode(mergedUpdates);

        final var combined = new ArrayList<byte[]>(existingUpdates.size() + newUpdates.size());
        combined.addAll(existingUpdates);
        combined.addAll(newUpdates);

        if (combined.size() > COMPACTION_WARN_THRESHOLD) {
            log.warn(
                "Y.Doc 스냅샷 컴팩션 필요: diagramId={}, 누적 update {}개 (임계치: {})",
                diagramId,
                combined.size(),
                COMPACTION_WARN_THRESHOLD
            );
        }

        return YjsUpdateFormat.encode(combined);
    }

    // ── SmartLifecycle 구현 ──

    /**
     * 서버 종료 시 모든 dirty 다이어그램 및 인메모리 누적 update를 DB에 저장한다.
     */
    @Override
    public void stop() {
        log.info("서버 종료: 인메모리 Y.Doc 스냅샷 일괄 flush 시작");

        // 1. dirty 다이어그램 flush
        final var dirtyIds = roomManager.getDirtyIdsAndClear();

        // 2. 누적 update가 있는 모든 다이어그램 ID 추가 (dirty에 포함되지 않은 것도 포함)
        final var allIdsWithUpdates = roomManager.getAllDiagramIdsWithUpdates();
        final var allIds = new java.util.HashSet<>(dirtyIds);
        allIds.addAll(allIdsWithUpdates);

        if (allIds.isEmpty()) {
            log.info("서버 종료: flush할 다이어그램 없음");
            running = false;
            return;
        }

        var savedCount = 0;
        for (final var id : allIds) {
            if (flushSingleDiagram(id)) {
                savedCount++;
            }
        }

        log.info("서버 종료: Y.Doc 스냅샷 일괄 flush 완료 ({}개 저장)", savedCount);
        running = false;
    }

    @Override
    public void start() {
        running = true;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    /**
     * 종료 단계를 반환한다.
     * WebSocket 핸들러보다 나중에 종료되어야 하므로 높은 값을 반환한다.
     *
     * @return 종료 단계
     */
    @Override
    public int getPhase() {
        return Integer.MAX_VALUE - 1;
    }

    /**
     * 비동기 종료를 위한 콜백 메서드 (SmartLifecycle).
     * 타임아웃 가드를 두어 flush가 지연되더라도 Spring 종료를 차단하지 않도록 한다.
     *
     * @param callback 종료 완료 콜백
     */
    @Override
    public void stop(Runnable callback) {
        final ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.submit((Runnable) this::stop);
        executor.shutdown();
        try {
            if (!executor.awaitTermination(SHUTDOWN_FLUSH_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                log.warn(
                    "서버 종료: Y.Doc flush 타임아웃 ({}초) 초과, 미저장 update가 유실될 수 있음",
                    SHUTDOWN_FLUSH_TIMEOUT_SECONDS
                );
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("서버 종료: Y.Doc flush 중 인터럽트 발생");
        }
        callback.run();
    }
}
