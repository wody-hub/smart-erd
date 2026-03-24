package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 마지막 세션 퇴장 후 drain된 update를 persisted snapshot에 반영한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FlushDiagramDrainedUpdatesUseCase {

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotService snapshotService;

    /**
     * room이 비워진 뒤 drain된 update를 flush한다.
     *
     * @param diagramId 다이어그램 ID
     * @param drainedUpdates drain된 update
     */
    public void flush(Long diagramId, byte[] drainedUpdates) {
        snapshotService.clearCompactionCoolDown(diagramId);
        try {
            if (drainedUpdates != null && drainedUpdates.length > 0) {
                synchronized (roomManager.getFlushLock(diagramId)) {
                    try {
                        snapshotService.saveSnapshotWithUpdates(diagramId, drainedUpdates);
                    } catch (Exception e) {
                        restoreDrainedUpdates(diagramId, drainedUpdates);
                        log.error("연결 종료 flush 실패, drain된 update 복원 (diagramId={})", diagramId, e);
                    }
                }
            }
        } finally {
            roomManager.removeFlushLock(diagramId);
        }
    }

    private void restoreDrainedUpdates(Long diagramId, byte[] drainedUpdates) {
        final var restored = roomManager.restoreUpdates(diagramId, drainedUpdates);
        if (!restored) {
            log.error("연결 종료 flush 실패 후 update 복원 실패 (diagramId={})", diagramId);
        }
    }
}
