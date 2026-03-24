package com.smarterd.application.diagram.command;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FlushDiagramDrainedUpdatesUseCaseTest {

    @Test
    @DisplayName("drained update가 없으면 cooldown 정리 후 flush lock만 제거한다")
    void flush_whenNoDrainedUpdates_onlyClearsCooldownAndRemovesLock() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var snapshotService = mock(DiagramSnapshotService.class);
        final var useCase = new FlushDiagramDrainedUpdatesUseCase(roomManager, snapshotService);

        useCase.flush(1L, new byte[0]);

        verify(snapshotService).clearCompactionCoolDown(1L);
        verify(snapshotService, never()).saveSnapshotWithUpdates(1L, new byte[0]);
        verify(roomManager).removeFlushLock(1L);
    }

    @Test
    @DisplayName("flush 실패 시 drain된 update를 복원한다")
    void flush_whenSaveFails_restoresUpdates() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var snapshotService = mock(DiagramSnapshotService.class);
        final var useCase = new FlushDiagramDrainedUpdatesUseCase(roomManager, snapshotService);
        final var flushLock = new Object();
        final var drained = new byte[] { 0x11, 0x22 };

        when(roomManager.getFlushLock(1L)).thenReturn(flushLock);
        when(roomManager.restoreUpdates(1L, drained)).thenReturn(true);
        org.mockito.Mockito.doThrow(new IllegalStateException("boom"))
            .when(snapshotService)
            .saveSnapshotWithUpdates(1L, drained);

        useCase.flush(1L, drained);

        verify(snapshotService).clearCompactionCoolDown(1L);
        verify(snapshotService).saveSnapshotWithUpdates(1L, drained);
        verify(roomManager).restoreUpdates(1L, drained);
        verify(roomManager).removeFlushLock(1L);
    }
}
