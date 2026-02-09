package com.smarterd.api.diagram.dto;

import com.smarterd.domain.diagram.entity.Diagram;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/**
 * 다이어그램 상세용 응답 DTO (content 포함).
 *
 * @param id        다이어그램 ID
 * @param name      다이어그램 이름
 * @param projectId 소속 프로젝트 ID
 * @param content   직렬화된 React Flow JSON (노드 + 엣지)
 * @param createdAt 생성 시각
 * @param updatedAt 수정 시각
 */
@Schema(description = "다이어그램 상세 응답 (content 포함)")
public record DiagramDetailResponse(
    @Schema(description = "다이어그램 ID", example = "1") Long id,

    @Schema(description = "다이어그램 이름", example = "Main ERD") String name,

    @Schema(description = "소속 프로젝트 ID", example = "1") Long projectId,

    @Schema(description = "직렬화된 React Flow JSON") String content,

    @Schema(description = "생성 시각") LocalDateTime createdAt,

    @Schema(description = "수정 시각") LocalDateTime updatedAt
) {
    /**
     * Diagram 엔티티로부터 상세 응답 DTO를 생성한다.
     *
     * @param diagram Diagram 엔티티
     * @return DiagramDetailResponse
     */
    public static DiagramDetailResponse from(Diagram diagram) {
        return new DiagramDetailResponse(
            diagram.getId(),
            diagram.getName(),
            diagram.getProject().getId(),
            diagram.getContent(),
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }
}
