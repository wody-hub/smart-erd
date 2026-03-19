package com.smarterd.api.diagram.dto;

import com.smarterd.domain.diagram.entity.Diagram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 다이어그램 저장 응답 DTO.
 *
 * <p>저장 직후 최신 contentRevision과 snapshot 상태를 반환하여
 * 클라이언트가 stale 상태 없이 후속 draft snapshot 저장을 이어갈 수 있게 한다.</p>
 *
 * @param contentRevision   최신 content 리비전
 * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부
 * @param snapshotRevision  snapshot 리비전
 * @param snapshotUpdatedAt snapshot 저장 시각
 * @param updatedAt         최종 수정 시각
 */
@Schema(description = "다이어그램 저장 응답")
public record SaveDiagramResponse(
    @Schema(description = "최신 content 리비전", example = "12") String contentRevision,
    @Schema(description = "Y.Doc 스냅샷 존재 여부") boolean hasYdocSnapshot,
    @Schema(description = "snapshot 리비전", nullable = true) String snapshotRevision,
    @Schema(description = "snapshot 저장 시각", nullable = true) Instant snapshotUpdatedAt,
    @Schema(description = "최종 수정 시각") Instant updatedAt
) {
    /**
     * Diagram 엔티티에서 저장 응답 DTO를 생성한다.
     *
     * @param diagram 저장 직후 다이어그램 엔티티
     * @return 저장 응답 DTO
     */
    public static SaveDiagramResponse from(Diagram diagram) {
        return new SaveDiagramResponse(
            String.valueOf(diagram.getContentRevision()),
            diagram.getYdocSnapshot() != null,
            diagram.getSnapshotRevision() != null ? String.valueOf(diagram.getSnapshotRevision()) : null,
            diagram.getSnapshotUpdatedAt(),
            diagram.getUpdatedAt()
        );
    }
}
