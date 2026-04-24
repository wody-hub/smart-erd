package com.smarterd.api.project.dto.issue;

import java.util.List;

/**
 * 프로젝트 이슈 목록 응답 DTO.
 */
public record ProjectIssueListResponse(
    List<ProjectIssueResponse> items,
    ProjectIssueSummaryResponse summary
) {
    /**
     * 이슈 목록 응답 DTO를 생성한다.
     *
     * @param items 이슈 목록
     * @return 목록 + 요약 응답
     */
    public static ProjectIssueListResponse from(List<ProjectIssueResponse> items) {
        return new ProjectIssueListResponse(items, ProjectIssueSummaryResponse.from(items));
    }
}
