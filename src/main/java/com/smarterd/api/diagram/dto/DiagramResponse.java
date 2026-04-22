package com.smarterd.api.diagram.dto;

import com.smarterd.domain.diagram.entity.Diagram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 다이어그램 목록용 응답 DTO (content 미포함).
 *
 * @param id        다이어그램 ID
 * @param name      다이어그램 이름
 * @param pluginId  문서 플러그인 ID
 * @param projectId 소속 프로젝트 ID
 * @param dictionarySetId 적용 사전 세트 ID
 * @param dictionarySetName 적용 사전 세트 이름
 * @param templateKey markdown 템플릿 키
 * @param templateLabel markdown 템플릿 표시 이름
 * @param summaryText markdown 요약 문구
 * @param createdAt 생성 시각
 * @param updatedAt 수정 시각
 */
@Schema(description = "다이어그램 응답 (목록용)")
public record DiagramResponse(
    @Schema(description = "다이어그램 ID", example = "1") Long id,

    @Schema(description = "다이어그램 이름", example = "Main ERD") String name,

    @Schema(description = "문서 플러그인 ID", example = "erd") String pluginId,

    @Schema(description = "소속 프로젝트 ID", example = "1") Long projectId,

    @Schema(description = "사전 세트 ID", example = "1") Long dictionarySetId,

    @Schema(description = "사전 세트 이름", example = "Default") String dictionarySetName,

    @Schema(description = "markdown 템플릿 키", example = "technical-spec") String templateKey,

    @Schema(description = "markdown 템플릿 표시 이름", example = "Technical Spec") String templateLabel,

    @Schema(description = "markdown 요약", example = "Describe the goal, scope, and intended audience.")
    String summaryText,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    /**
     * Diagram 엔티티로부터 목록용 응답 DTO를 생성한다.
     *
     * <p>{@code projectId}를 직접 받아 LAZY 프록시 초기화를 방지한다.</p>
     *
     * @param diagram   Diagram 엔티티
     * @param projectId 소속 프로젝트 ID
     * @return DiagramResponse
     */
    public static DiagramResponse from(Diagram diagram, Long projectId) {
        return new DiagramResponse(
            diagram.getId(),
            diagram.getName(),
            diagram.getPluginId(),
            projectId,
            diagram.getDictionarySet() != null ? diagram.getDictionarySet().getId() : null,
            diagram.getDictionarySet() != null ? diagram.getDictionarySet().getName() : null,
            null,
            null,
            null,
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }
}
