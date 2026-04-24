package com.smarterd.api.project.dto.issue;

import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 프로젝트 이슈 상태 변경 요청 DTO.
 */
@Schema(description = "프로젝트 이슈 상태 변경 요청")
public record UpdateProjectIssueStatusRequest(
    @Schema(description = "다음 상태", example = "IN_PROGRESS")
    @NotNull(message = "{validation.not-null.issue-status}")
    ProjectIssueStatus status
) {}
