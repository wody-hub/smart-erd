package com.smarterd.api.project.dto.todo;

import com.smarterd.domain.pm.todo.service.ProjectTodoService.SharedTodoSummaryResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import org.springframework.lang.Nullable;

/**
 * WBS에서 노출하는 공유 TODO 요약 응답 DTO.
 */
@Schema(description = "WBS 연결 TODO 공유 요약 응답")
public record SharedTodoSummaryResponse(
    @Schema(description = "TODO ID", example = "301") Long id,
    @Schema(description = "TODO 제목", example = "API 응답 계약 정리") String title,
    @Schema(description = "TODO 상태", example = "IN_PROGRESS") String status,
    @Schema(description = "TODO 우선순위", example = "HIGH") String priority,
    @Nullable @Schema(description = "목표일", example = "2026-04-30") LocalDate targetDate,
    @Schema(description = "진척률 (0~100)", example = "20") int progressRate,
    @Schema(description = "소유자 사용자 ID", example = "7") Long ownerUserId,
    @Schema(description = "소유자 이름", example = "김개발") String ownerName,
    @Schema(description = "공유 문서 목록") List<TodoDocumentResponse> sharedDocuments
) {
    public static SharedTodoSummaryResponse from(SharedTodoSummaryResult result) {
        return new SharedTodoSummaryResponse(
            result.id(),
            result.title(),
            result.status().name(),
            result.priority().name(),
            result.targetDate(),
            result.progressRate(),
            result.ownerUserId(),
            result.ownerName(),
            result.sharedDocuments().stream().map(TodoDocumentResponse::from).toList()
        );
    }
}
