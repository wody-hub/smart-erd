package com.smarterd.api.project.dto.issue;

import com.smarterd.domain.pm.issue.entity.ProjectIssue;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 이슈 수정 요청 DTO.
 */
@Schema(description = "프로젝트 이슈 수정 요청")
public record UpdateProjectIssueRequest(
    @Schema(description = "이슈 제목", example = "API 응답 정렬 규칙 보완")
    @NotBlank(message = "{validation.not-blank.issue-title}")
    @Size(max = ProjectIssue.MAX_TITLE_LENGTH, message = "{validation.size.issue-title}")
    String title,

    @Schema(description = "이슈 내용", example = "status/priority 필터와 export 결과가 일치하도록 서버 정렬 규칙을 보완한다.")
    @Nullable
    @Size(max = ProjectIssue.MAX_DESCRIPTION_LENGTH, message = "{validation.size.issue-description}")
    String description,

    @Schema(description = "이슈 우선순위", example = "HIGH")
    @NotNull(message = "{validation.not-null.issue-priority}")
    ProjectIssuePriority priority,

    @Schema(description = "담당자 사용자 ID", example = "7") @Nullable Long assigneeUserId
) {}
