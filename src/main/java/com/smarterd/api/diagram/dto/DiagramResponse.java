package com.smarterd.api.diagram.dto;

import com.smarterd.domain.diagram.entity.Diagram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 다이어그램 목록용 응답 DTO (content 미포함).
 *
 * @param id        다이어그램 ID
 * @param name      다이어그램 이름
 * @param projectId 소속 프로젝트 ID
 * @param createdAt 생성 시각
 * @param updatedAt 수정 시각
 */
@Schema(description = "다이어그램 응답 (목록용)")
public record DiagramResponse(
    @Schema(description = "다이어그램 ID", example = "1") Long id,

    @Schema(description = "다이어그램 이름", example = "Main ERD") String name,

    @Schema(description = "소속 프로젝트 ID", example = "1") Long projectId,

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
            projectId,
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }
}
