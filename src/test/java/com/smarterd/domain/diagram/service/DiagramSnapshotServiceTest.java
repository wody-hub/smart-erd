package com.smarterd.domain.diagram.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * {@link DiagramSnapshotService} 단위 테스트.
 */
@ExtendWith(MockitoExtension.class)
class DiagramSnapshotServiceTest {

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private DiagramRoomManager roomManager;

    @Mock
    private TransactionTemplate transactionTemplate;

    @InjectMocks
    private DiagramSnapshotService diagramSnapshotService;

    @Test
    @DisplayName("replaceSnapshot - 컴팩션 결과가 기존보다 작으면 교체에 성공한다")
    void replaceSnapshot_compactedSmallerThanExisting_returnsTrue() {
        // given
        final var diagramId = 1L;
        final var compactedUpdate = new byte[50];
        final var contentRevision = 7L;

        // 기존 스냅샷: YLPF 포맷으로 인코딩된 200바이트짜리 update
        final var existingSnapshot = YjsUpdateFormat.encode(List.of(new byte[200]));
        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(existingSnapshot));
        when(diagramRepository.findContentRevisionForUpdate(diagramId)).thenReturn(contentRevision);
        when(
            diagramRepository.updateYdocSnapshotAndRevisionById(eq(diagramId), any(byte[].class), eq(contentRevision))
        ).thenReturn(1L);

        // when
        final var result = diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(result).isTrue();
        verify(diagramRepository).updateYdocSnapshotAndRevisionById(
            eq(diagramId),
            any(byte[].class),
            eq(contentRevision)
        );
    }

    @Test
    @DisplayName("replaceSnapshot - 컴팩션 결과가 기존 크기의 110%를 초과하면 거부한다")
    void replaceSnapshot_compactedExceedsTolerance_returnsFalse() {
        // given
        final var diagramId = 1L;
        // 기존 스냅샷: 작은 크기 (20바이트 = magic 4 + len 4 + data 12)
        final var existingSnapshot = YjsUpdateFormat.encode(List.of(new byte[12]));
        // 컴팩션 결과: 200바이트 → 인코딩 후 208바이트 (기존 20바이트 * 1.1 = 22바이트 초과)
        final var compactedUpdate = new byte[200];

        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(existingSnapshot));

        // when
        final var result = diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(result).isFalse();
        verify(diagramRepository, never()).updateYdocSnapshotAndRevisionById(any(), any(), anyLong());
    }

    @Test
    @DisplayName("replaceSnapshot - 다이어그램이 존재하지 않으면 false를 반환한다")
    void replaceSnapshot_diagramNotFound_returnsFalse() {
        // given
        final var diagramId = 999L;
        final var compactedUpdate = new byte[50];

        when(diagramRepository.findContentRevisionForUpdate(diagramId)).thenReturn(null);

        // when
        final var result = diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("replaceSnapshot - 기존 스냅샷이 없으면 크기 검증을 건너뛰고 성공한다")
    void replaceSnapshot_noExistingSnapshot_skipsValidationAndSucceeds() {
        // given
        final var diagramId = 1L;
        final var compactedUpdate = new byte[100];
        final var contentRevision = 9L;

        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.empty());
        when(diagramRepository.findContentRevisionForUpdate(diagramId)).thenReturn(contentRevision);
        when(
            diagramRepository.updateYdocSnapshotAndRevisionById(eq(diagramId), any(byte[].class), eq(contentRevision))
        ).thenReturn(1L);

        // when
        final var result = diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(result).isTrue();
        verify(diagramRepository).updateYdocSnapshotAndRevisionById(
            eq(diagramId),
            any(byte[].class),
            eq(contentRevision)
        );
    }

    @Test
    @DisplayName("isCompactionInCoolDown - 성공 직후에는 쿨다운 상태여야 한다")
    void isCompactionInCoolDown_justAfterSuccess_returnsTrue() {
        // given
        final var diagramId = 1L;
        final var compactedUpdate = new byte[50];
        final var contentRevision = 11L;
        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(new byte[0]));
        when(diagramRepository.findContentRevisionForUpdate(diagramId)).thenReturn(contentRevision);
        when(
            diagramRepository.updateYdocSnapshotAndRevisionById(eq(diagramId), any(byte[].class), eq(contentRevision))
        ).thenReturn(1L);

        // when
        diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(diagramSnapshotService.isCompactionInCoolDown(diagramId)).isTrue();
    }

    @Test
    @DisplayName("setCompactionRejectCoolDown - 호출 시 쿨다운 상태여야 한다")
    void setCompactionRejectCoolDown_afterCall_returnsTrue() {
        // given
        final var diagramId = 2L;

        // when
        diagramSnapshotService.setCompactionRejectCoolDown(diagramId);

        // then
        assertThat(diagramSnapshotService.isCompactionInCoolDown(diagramId)).isTrue();
    }

    @Test
    @DisplayName("clearCompactionCoolDown - 호출 시 쿨다운이 해제되어야 한다")
    void clearCompactionCoolDown_afterCall_returnsFalse() {
        // given
        final var diagramId = 3L;
        diagramSnapshotService.setCompactionRejectCoolDown(diagramId);
        assertThat(diagramSnapshotService.isCompactionInCoolDown(diagramId)).isTrue();

        // when
        diagramSnapshotService.clearCompactionCoolDown(diagramId);

        // then
        assertThat(diagramSnapshotService.isCompactionInCoolDown(diagramId)).isFalse();
    }

    @Test
    @DisplayName("reconcileRealtimeStateWithPersistedContent - null snapshot이면 stale cache/room을 함께 비운다")
    void reconcileRealtimeStateWithPersistedContent_whenSnapshotIsNull_discardsStaleRealtimeState() {
        // given
        final var diagramId = 10L;
        final var persistedSnapshot = new byte[] { 1, 2, 3 };
        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(persistedSnapshot));

        // warm cache
        assertThat(diagramSnapshotService.loadSnapshot(diagramId)).isEqualTo(persistedSnapshot);
        assertThat(diagramSnapshotService.getCachedSnapshot(diagramId)).contains(persistedSnapshot);

        // when
        diagramSnapshotService.reconcileRealtimeStateWithPersistedContent(diagramId, null);

        // then
        assertThat(diagramSnapshotService.getCachedSnapshot(diagramId)).isEmpty();
        verify(roomManager).discardRoom(diagramId);
        verify(roomManager, never()).replaceUpdates(eq(diagramId), any(byte[].class));
    }

    @Test
    @DisplayName(
        "reconcileRealtimeStateWithPersistedContentAfterCommit - snapshot 없이 저장한 구버전 클라이언트는 active room을 강제로 버리지 않는다"
    )
    void reconcileRealtimeStateWithPersistedContentAfterCommit_whenSnapshotIsNullAndRoomActive_preservesRoom() {
        // given
        final var diagramId = 12L;
        final var persistedSnapshot = new byte[] { 4, 5, 6 };
        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(persistedSnapshot));
        when(roomManager.getSessionCount(diagramId)).thenReturn(2);

        assertThat(diagramSnapshotService.loadSnapshot(diagramId)).isEqualTo(persistedSnapshot);
        assertThat(diagramSnapshotService.getCachedSnapshot(diagramId)).contains(persistedSnapshot);

        // when
        diagramSnapshotService.reconcileRealtimeStateWithPersistedContentAfterCommit(diagramId, null);

        // then
        assertThat(diagramSnapshotService.getCachedSnapshot(diagramId)).isEmpty();
        verify(roomManager, never()).discardRoom(diagramId);
        verify(roomManager, never()).replaceUpdates(eq(diagramId), any(byte[].class));
    }

    @Test
    @DisplayName(
        "reconcileRealtimeStateWithPersistedContent - full state update면 cache와 room update를 최신 상태로 교체한다"
    )
    void reconcileRealtimeStateWithPersistedContent_whenSnapshotProvided_replacesCacheAndRoomState() {
        // given
        final var diagramId = 11L;
        final var fullStateUpdate = new byte[] { 9, 8, 7 };

        // when
        diagramSnapshotService.reconcileRealtimeStateWithPersistedContent(diagramId, fullStateUpdate);

        // then
        assertThat(diagramSnapshotService.getCachedSnapshot(diagramId)).contains(
            YjsUpdateFormat.encode(List.of(fullStateUpdate))
        );
        verify(roomManager).replaceUpdates(diagramId, fullStateUpdate);
        verify(roomManager, never()).discardRoom(diagramId);
    }
}
