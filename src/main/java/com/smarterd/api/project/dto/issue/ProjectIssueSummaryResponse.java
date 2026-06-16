package com.smarterd.api.project.dto.issue;

import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 프로젝트 이슈 상태별 요약 응답 DTO.
 */
@Schema(description = "프로젝트 이슈 상태별 요약 응답")
public record ProjectIssueSummaryResponse(
    @Schema(description = "전체 이슈 수", example = "12") long totalCount,
    @Schema(description = "등록 상태 이슈 수", example = "5") long registeredCount,
    @Schema(description = "진행 중 상태 이슈 수", example = "4") long inProgressCount,
    @Schema(description = "완료 상태 이슈 수", example = "3") long doneCount
) {
    /**
     * 이슈 목록에서 상태별 집계를 계산한다.
     *
     * @param items 이슈 목록
     * @return 상태 요약
     */
    public static ProjectIssueSummaryResponse from(List<ProjectIssueResponse> items) {
        final var registeredCount = items
            .stream()
            .filter((item) -> item.status() == ProjectIssueStatus.REGISTERED)
            .count();
        final var inProgressCount = items
            .stream()
            .filter((item) -> item.status() == ProjectIssueStatus.IN_PROGRESS)
            .count();
        final var doneCount = items
            .stream()
            .filter((item) -> item.status() == ProjectIssueStatus.DONE)
            .count();
        return new ProjectIssueSummaryResponse(items.size(), registeredCount, inProgressCount, doneCount);
    }
}
