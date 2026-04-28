package com.smarterd.api.project.dto.todo;

import com.smarterd.domain.pm.todo.service.ProjectTodoService.ProjectTodoResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 개인 TODO 응답 DTO.
 */
@Schema(description = "개인 TODO 응답")
public record ProjectTodoResponse(
    @Schema(description = "TODO ID", example = "301") Long id,
    @Schema(description = "TODO 제목", example = "API 응답 계약 정리") String title,
    @Nullable @Schema(description = "개인 메모/설명") String description,
    @Schema(description = "TODO 상태", example = "IN_PROGRESS") String status,
    @Schema(description = "TODO 우선순위", example = "HIGH") String priority,
    @Nullable @Schema(description = "목표일", example = "2026-04-30") LocalDate targetDate,
    @Schema(description = "진척률 (0~100)", example = "20") int progressRate,
    @Nullable @Schema(description = "연결된 WBS 항목 ID", example = "100") Long linkedWbsItemId,
    @Nullable @Schema(description = "연결된 WBS 항목명", example = "백엔드 API") String linkedWbsItemName,
    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,
    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static ProjectTodoResponse from(ProjectTodoResult result) {
        return new ProjectTodoResponse(
            result.id(),
            result.title(),
            result.description(),
            result.status().name(),
            result.priority().name(),
            result.targetDate(),
            result.progressRate(),
            result.linkedWbsItemId(),
            result.linkedWbsItemName(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
