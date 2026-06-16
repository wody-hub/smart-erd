package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.HashSet;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * dirty Y.Doc update의 주기적/종료 시점 flush를 담당한다.
 */
@Slf4j
final class DiagramSnapshotFlushSupport {

    private final DiagramRepository diagramRepository;
    private final DiagramRoomManager roomManager;
    private final TransactionTemplate transactionTemplate;
    private final DiagramSnapshotCacheSupport cacheSupport;
    private final AtomicLong snapshotFlushFailCount = new AtomicLong(0);

    /**
     * @param diagramRepository 다이어그램 레포지토리
     * @param roomManager 방 관리자
     * @param transactionTemplate 다이어그램별 트랜잭션 실행 객체
     * @param cacheSupport snapshot 캐시 지원 객체
     */
    DiagramSnapshotFlushSupport(
        DiagramRepository diagramRepository,
        DiagramRoomManager roomManager,
        TransactionTemplate transactionTemplate,
        DiagramSnapshotCacheSupport cacheSupport
    ) {
        this.diagramRepository = diagramRepository;
        this.roomManager = roomManager;
        this.transactionTemplate = transactionTemplate;
        this.cacheSupport = cacheSupport;
    }

    /**
     * dirty 다이어그램 snapshot을 주기적으로 저장한다.
     */
    void flushDirtySnapshots() {
        final var dirtyIds = roomManager.getDirtyIdsAndClear();
        if (dirtyIds.isEmpty()) {
            return;
        }

        try {
            final var failCountBefore = snapshotFlushFailCount.get();
            var savedCount = 0;
            for (final var id : dirtyIds) {
                if (flushSingleDiagram(id)) {
                    savedCount++;
                }
            }
            logFlushMetrics(savedCount, Math.max(0, snapshotFlushFailCount.get() - failCountBefore));
        } catch (Exception e) {
            final var totalFailCount = addSnapshotFlushFailCount(dirtyIds.size(), "batch-exception", null);
            log.error("주기적 스냅샷 저장 중 예외 발생, dirty ID 복구: {}개", dirtyIds.size(), e);
            log.warn("snapshot_flush_fail_count={} reason=batch-exception", totalFailCount);
            for (final var id : dirtyIds) {
                roomManager.reDirty(id);
            }
        }
    }

    /**
     * 단일 다이어그램의 누적 update를 DB에 저장한다.
     *
     * @param id 다이어그램 ID
     * @return 저장 성공 여부
     */
    boolean flushSingleDiagram(Long id) {
        synchronized (roomManager.getFlushLock(id)) {
            byte[] mergedUpdates = null;
            try {
                mergedUpdates = roomManager.drainAndMergeUpdates(id);
                if (mergedUpdates.length == 0) {
                    return false;
                }
                return doFlushInTransaction(id, mergedUpdates);
            } catch (Exception e) {
                handleSingleFlushFailure(id, mergedUpdates, e);
                return false;
            }
        }
    }

    /**
     * 서버 종료 시 dirty 및 update 보유 다이어그램을 모두 flush한다.
     *
     * @return shutdown flush 결과
     */
    DiagramSnapshotShutdownFlushResult flushAllOnShutdown() {
        final var dirtyIds = roomManager.getDirtyIdsAndClear();
        final var allIdsWithUpdates = roomManager.getAllDiagramIdsWithUpdates();
        final var allIds = new HashSet<>(dirtyIds);
        allIds.addAll(allIdsWithUpdates);

        if (allIds.isEmpty()) {
            return new DiagramSnapshotShutdownFlushResult(false, 0);
        }

        var savedCount = 0;
        for (final var id : allIds) {
            if (flushSingleDiagram(id)) {
                savedCount++;
            }
        }
        return new DiagramSnapshotShutdownFlushResult(true, savedCount);
    }

    /**
     * 트랜잭션 내에서 drain된 update를 DB snapshot에 병합하여 저장한다.
     *
     * @param id 다이어그램 ID
     * @param mergedUpdates drain된 Yjs update
     * @return 저장 성공 여부
     */
    private boolean doFlushInTransaction(Long id, byte[] mergedUpdates) {
        final var result = transactionTemplate.execute((status) -> {
            final var contentRevision = diagramRepository.findContentRevisionForUpdate(id);
            if (contentRevision == null) {
                logFlushFailure(1, "diagram-not-found", id, "주기적 스냅샷 저장 실패: 다이어그램 미존재 (id={})");
                return false;
            }
            final var existingSnapshot = diagramRepository.findYdocSnapshotById(id).orElse(new byte[0]);
            final var combined = cacheSupport.combineSnapshotAndUpdates(id, existingSnapshot, mergedUpdates);
            final var updated = diagramRepository.updateYdocSnapshotAndRevisionById(id, combined, contentRevision);
            if (updated == 0) {
                logFlushFailure(1, "update-failed", id, "주기적 스냅샷 저장 실패: UPDATE 실패 (id={})");
                return false;
            }
            cacheSupport.cacheSnapshot(id, combined);
            log.debug(
                "주기적 Y.Doc 스냅샷 저장: diagramId={}, size={}bytes, snapshotRevision={}",
                id,
                combined.length,
                contentRevision
            );
            return true;
        });
        return Boolean.TRUE.equals(result);
    }

    /**
     * 단일 flush 실패를 기록하고 drain된 update를 복원한다.
     *
     * @param id 다이어그램 ID
     * @param mergedUpdates drain된 update
     * @param exception 발생 예외
     */
    private void handleSingleFlushFailure(Long id, byte[] mergedUpdates, Exception exception) {
        final var totalFailCount = addSnapshotFlushFailCount(1, "exception", id);
        log.error("주기적 스냅샷 저장 실패 (diagramId={})", id, exception);
        log.warn("snapshot_flush_fail_count={} reason=exception diagramId={}", totalFailCount, id);
        final var restored = roomManager.restoreUpdates(id, mergedUpdates);
        if (!restored) {
            log.error("주기적 스냅샷 저장 실패 후 update 복원 실패 (diagramId={})", id);
        }
    }

    /**
     * flush 메트릭 로그를 남긴다.
     *
     * @param savedCount 저장 성공 수
     * @param runFailedCount 이번 실행 실패 수
     */
    private void logFlushMetrics(int savedCount, long runFailedCount) {
        if (savedCount > 0 || runFailedCount > 0) {
            log.info(
                "snapshot-flush-metrics saved={}, failed={}, snapshot_flush_fail_count={}",
                savedCount,
                runFailedCount,
                snapshotFlushFailCount.get()
            );
        }
    }

    /**
     * flush 실패를 카운팅하고 경고 로그를 남긴다.
     *
     * @param delta 증가량
     * @param reason 실패 사유
     * @param diagramId 다이어그램 ID
     * @param message 실패 메시지
     */
    private void logFlushFailure(long delta, String reason, Long diagramId, String message) {
        final var totalFailCount = addSnapshotFlushFailCount(delta, reason, diagramId);
        log.warn(message, diagramId);
        log.warn("snapshot_flush_fail_count={} reason={} diagramId={}", totalFailCount, reason, diagramId);
    }

    /**
     * 스냅샷 flush 실패 누적 카운터를 증가시킨다.
     *
     * @param delta 증가량
     * @param reason 실패 사유
     * @param diagramId 다이어그램 ID
     * @return 증가 후 누적 카운터 값
     */
    private long addSnapshotFlushFailCount(long delta, String reason, Long diagramId) {
        final var total = snapshotFlushFailCount.addAndGet(Math.max(0L, delta));
        if (diagramId == null) {
            log.debug("snapshot_flush_fail_count={} reason={}", total, reason);
            return total;
        }
        log.debug("snapshot_flush_fail_count={} reason={} diagramId={}", total, reason, diagramId);
        return total;
    }
}
