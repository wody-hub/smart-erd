package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 클라이언트가 보낸 compacted snapshot 교체를 적용한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApplyDiagramCompactedSnapshotUseCase {

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotService snapshotService;

    /**
     * compacted snapshot을 적용한다.
     *
     * @param diagramId 다이어그램 ID
     * @param compactedUpdate 클라이언트가 전송한 compacted update
     */
    public void apply(Long diagramId, byte[] compactedUpdate) {
        if (compactedUpdate == null || compactedUpdate.length == 0) {
            return;
        }

        synchronized (roomManager.getFlushLock(diagramId)) {
            if (snapshotService.isCompactionInCoolDown(diagramId)) {
                return;
            }

            final var mergedUpdates = roomManager.drainIfAlone(diagramId);
            if (mergedUpdates == null) {
                snapshotService.setCompactionRejectCoolDown(diagramId);
                if (log.isDebugEnabled()) {
                    log.debug("컴팩션 스킵: 단독 접속 아님 (diagramId={})", diagramId);
                }
                return;
            }

            try {
                final var success = snapshotService.replaceSnapshot(diagramId, compactedUpdate);
                if (!success) {
                    restoreDrainedUpdates(diagramId, mergedUpdates, "컴팩션 실패 후 update 복원 실패");
                }
            } catch (Exception e) {
                restoreDrainedUpdates(diagramId, mergedUpdates, "컴팩션 예외 후 update 복원 실패");
                log.error("컴팩션 실패, drain된 update 복원 (diagramId={})", diagramId, e);
            }
        }
    }

    private void restoreDrainedUpdates(Long diagramId, byte[] mergedUpdates, String failureMessage) {
        final var restored = roomManager.restoreUpdates(diagramId, mergedUpdates);
        if (!restored) {
            log.error("{} (diagramId={})", failureMessage, diagramId);
        }
    }
}
