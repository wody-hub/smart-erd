package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * persisted snapshot 변경 이후 realtime room/cache 상태 정렬을 담당한다.
 */
@Slf4j
final class DiagramRealtimeSnapshotStateSupport {

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotCacheSupport cacheSupport;
    private final DiagramSnapshotCompactionSupport compactionSupport;

    /**
     * @param roomManager 방 관리자
     * @param cacheSupport snapshot 캐시 지원 객체
     * @param compactionSupport 컴팩션 지원 객체
     */
    DiagramRealtimeSnapshotStateSupport(
        DiagramRoomManager roomManager,
        DiagramSnapshotCacheSupport cacheSupport,
        DiagramSnapshotCompactionSupport compactionSupport
    ) {
        this.roomManager = roomManager;
        this.cacheSupport = cacheSupport;
        this.compactionSupport = compactionSupport;
    }

    /**
     * 커밋 이후 persisted 기준으로 realtime 상태를 정렬한다.
     *
     * @param diagramId 다이어그램 ID
     * @param fullStateUpdate 전체 Y.Doc 상태 update
     */
    void reconcileAfterCommit(Long diagramId, byte[] fullStateUpdate) {
        final var snapshotCopy = fullStateUpdate == null ? null : fullStateUpdate.clone();
        runAfterCommit(() -> reconcile(diagramId, snapshotCopy, true));
    }

    /**
     * 커밋 이후 persisted 기준으로 realtime 상태를 폐기한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void discardAfterCommit(Long diagramId) {
        runAfterCommit(() -> reconcile(diagramId, null, false));
    }

    /**
     * persisted 기준으로 realtime 상태를 정렬한다.
     *
     * @param diagramId 다이어그램 ID
     * @param fullStateUpdate 전체 Y.Doc 상태 update
     */
    void reconcile(Long diagramId, byte[] fullStateUpdate) {
        reconcile(diagramId, fullStateUpdate, false);
    }

    /**
     * persisted 기준으로 realtime 상태를 실제로 정렬한다.
     *
     * @param diagramId 다이어그램 ID
     * @param fullStateUpdate 전체 Y.Doc 상태 update
     * @param preserveActiveRoomWhenSnapshotMissing snapshot 부재 시 active room 보존 여부
     */
    private void reconcile(Long diagramId, byte[] fullStateUpdate, boolean preserveActiveRoomWhenSnapshotMissing) {
        if (fullStateUpdate == null || fullStateUpdate.length == 0) {
            cacheSupport.removeSnapshot(diagramId);
            compactionSupport.clearCompactionCoolDown(diagramId);
            if (preserveActiveRoomWhenSnapshotMissing && roomManager.getSessionCount(diagramId) > 0) {
                log.info(
                    "authoritative content 저장 후 realtime room 보존: diagramId={}, activeSessions={}",
                    diagramId,
                    roomManager.getSessionCount(diagramId)
                );
                return;
            }
            roomManager.discardRoom(diagramId);
            return;
        }

        cacheSupport.cacheSnapshot(diagramId, YjsUpdateFormat.encode(List.of(fullStateUpdate)));
        roomManager.replaceUpdates(diagramId, fullStateUpdate);
    }

    /**
     * 현재 트랜잭션이 있으면 after-commit으로, 없으면 즉시 실행한다.
     *
     * @param task 실행할 작업
     */
    private void runAfterCommit(Runnable task) {
        if (
            TransactionSynchronizationManager.isSynchronizationActive() &&
            TransactionSynchronizationManager.isActualTransactionActive()
        ) {
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    /**
                     * 트랜잭션 커밋 후 등록된 작업을 실행한다.
                     */
                    @Override
                    public void afterCommit() {
                        task.run();
                    }
                }
            );
            return;
        }
        task.run();
    }
}
