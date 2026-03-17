package com.smarterd.api.diagram.dto;

import com.smarterd.domain.diagram.entity.Diagram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 다이어그램 상세용 응답 DTO (content 포함).
 *
 * <p>Y.Doc 스냅샷은 REST 응답에 포함하지 않고, WebSocket SNAPSHOT_REQUEST로 별도 로딩한다.
 * 대형 바이너리 스냅샷의 REST 응답 크기 증가를 방지한다.</p>
 *
 * @param id                다이어그램 ID
 * @param name              다이어그램 이름
 * @param projectId         소속 프로젝트 ID
 * @param dictionarySetId   사전 세트 ID
 * @param dictionarySetName 사전 세트 이름
 * @param content           직렬화된 React Flow JSON (노드 + 엣지)
 * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부 (클라이언트 JSON 마이그레이션 판단용)
 * @param contentRevision   content 리비전 (long 문자열)
 * @param snapshotRevision  snapshot 리비전 (null 가능)
 * @param snapshotUpdatedAt snapshot 저장 시각
 * @param createdAt         생성 시각
 * @param updatedAt         수정 시각
 */
@Schema(description = "다이어그램 상세 응답 (content 포함)")
public record DiagramDetailResponse(
    @Schema(description = "다이어그램 ID", example = "1") Long id,

    @Schema(description = "다이어그램 이름", example = "Main ERD") String name,

    @Schema(description = "소속 프로젝트 ID", example = "1") Long projectId,

    @Schema(description = "사전 세트 ID", example = "1") Long dictionarySetId,

    @Schema(description = "사전 세트 이름", example = "Default") String dictionarySetName,

    @Schema(description = "직렬화된 React Flow JSON") String content,

    @Schema(description = "Y.Doc 스냅샷 존재 여부") boolean hasYdocSnapshot,

    @Schema(description = "content 리비전 (long 문자열)") String contentRevision,

    @Schema(description = "snapshot 리비전 (null 가능)") String snapshotRevision,

    @Schema(description = "snapshot 저장 시각") Instant snapshotUpdatedAt,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    /**
     * Diagram 엔티티로부터 상세 응답 DTO를 생성한다.
     *
     * <p>{@code projectId}를 직접 받아 LAZY 프록시 초기화를 방지한다.</p>
     *
     * @param diagram           Diagram 엔티티
     * @param projectId         소속 프로젝트 ID
     * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부
     * @return DiagramDetailResponse
     */
    public static DiagramDetailResponse from(Diagram diagram, Long projectId, boolean hasYdocSnapshot) {
        return new DiagramDetailResponse(
            diagram.getId(),
            diagram.getName(),
            projectId,
            diagram.getDictionarySet() != null ? diagram.getDictionarySet().getId() : null,
            diagram.getDictionarySet() != null ? diagram.getDictionarySet().getName() : null,
            diagram.getContent(),
            hasYdocSnapshot,
            String.valueOf(diagram.getContentRevision()),
            diagram.getSnapshotRevision() != null ? String.valueOf(diagram.getSnapshotRevision()) : null,
            diagram.getSnapshotUpdatedAt(),
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }
}
