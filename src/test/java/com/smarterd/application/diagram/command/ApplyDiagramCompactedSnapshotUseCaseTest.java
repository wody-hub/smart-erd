package com.smarterd.application.diagram.command;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ApplyDiagramCompactedSnapshotUseCaseTest {

    @Test
    @DisplayName("단독 접속이 아니면 reject cooldown만 설정한다")
    void apply_whenNotAlone_setsRejectCooldown() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var snapshotService = mock(DiagramSnapshotService.class);
        final var useCase = new ApplyDiagramCompactedSnapshotUseCase(roomManager, snapshotService);
        final var flushLock = new Object();

        when(roomManager.getFlushLock(1L)).thenReturn(flushLock);
        when(snapshotService.isCompactionInCoolDown(1L)).thenReturn(false);
        when(roomManager.drainIfAlone(1L)).thenReturn(null);

        useCase.apply(1L, new byte[] { 0x01 });

        verify(snapshotService).setCompactionRejectCoolDown(1L);
        verify(snapshotService, never()).replaceSnapshot(eq(1L), any());
    }

    @Test
    @DisplayName("snapshot 교체 실패 시 drain한 update를 복원한다")
    void apply_whenReplaceFails_restoresUpdates() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var snapshotService = mock(DiagramSnapshotService.class);
        final var useCase = new ApplyDiagramCompactedSnapshotUseCase(roomManager, snapshotService);
        final var flushLock = new Object();
        final var drained = new byte[] { 0x11, 0x22 };
        final var compacted = new byte[] { 0x01 };

        when(roomManager.getFlushLock(1L)).thenReturn(flushLock);
        when(snapshotService.isCompactionInCoolDown(1L)).thenReturn(false);
        when(roomManager.drainIfAlone(1L)).thenReturn(drained);
        when(snapshotService.replaceSnapshot(1L, compacted)).thenReturn(false);

        useCase.apply(1L, compacted);

        verify(roomManager).restoreUpdates(1L, drained);
    }

    @Test
    @DisplayName("snapshot 교체 중 예외가 나도 drain한 update를 복원한다")
    void apply_whenReplaceThrows_restoresUpdates() {
        final var roomManager = mock(DiagramRoomManager.class);
        final var snapshotService = mock(DiagramSnapshotService.class);
        final var useCase = new ApplyDiagramCompactedSnapshotUseCase(roomManager, snapshotService);
        final var flushLock = new Object();
        final var drained = new byte[] { 0x11, 0x22 };
        final var compacted = new byte[] { 0x01 };

        when(roomManager.getFlushLock(1L)).thenReturn(flushLock);
        when(snapshotService.isCompactionInCoolDown(1L)).thenReturn(false);
        when(roomManager.drainIfAlone(1L)).thenReturn(drained);
        when(snapshotService.replaceSnapshot(1L, compacted)).thenThrow(new IllegalStateException("boom"));

        useCase.apply(1L, compacted);

        verify(roomManager).restoreUpdates(1L, drained);
    }
}
