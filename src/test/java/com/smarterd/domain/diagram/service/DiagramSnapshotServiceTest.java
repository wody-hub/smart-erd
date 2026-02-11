package com.smarterd.domain.diagram.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.YjsUpdateFormat;
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

        // 기존 스냅샷: YLPF 포맷으로 인코딩된 200바이트짜리 update
        final var existingSnapshot = YjsUpdateFormat.encode(List.of(new byte[200]));
        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(existingSnapshot));
        when(diagramRepository.updateYdocSnapshotById(eq(diagramId), any(byte[].class))).thenReturn(1L);

        // when
        final var result = diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(result).isTrue();
        verify(diagramRepository).updateYdocSnapshotById(eq(diagramId), any(byte[].class));
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
        verify(diagramRepository, never()).updateYdocSnapshotById(any(), any());
    }

    @Test
    @DisplayName("replaceSnapshot - 다이어그램이 존재하지 않으면 false를 반환한다")
    void replaceSnapshot_diagramNotFound_returnsFalse() {
        // given
        final var diagramId = 999L;
        final var compactedUpdate = new byte[50];

        // 기존 스냅샷은 존재하지만 update 시 다이어그램 미존재 (0행 갱신)
        final var existingSnapshot = YjsUpdateFormat.encode(List.of(new byte[200]));
        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.of(existingSnapshot));
        when(diagramRepository.updateYdocSnapshotById(eq(diagramId), any(byte[].class))).thenReturn(0L);

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

        when(diagramRepository.findYdocSnapshotById(diagramId)).thenReturn(Optional.empty());
        when(diagramRepository.updateYdocSnapshotById(eq(diagramId), any(byte[].class))).thenReturn(1L);

        // when
        final var result = diagramSnapshotService.replaceSnapshot(diagramId, compactedUpdate);

        // then
        assertThat(result).isTrue();
        verify(diagramRepository).updateYdocSnapshotById(eq(diagramId), any(byte[].class));
    }
}
