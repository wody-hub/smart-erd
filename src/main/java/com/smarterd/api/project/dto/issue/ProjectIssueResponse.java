package com.smarterd.api.project.dto.issue;

import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.service.ProjectIssueService.ProjectIssueResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 이슈 응답 DTO.
 */
@Schema(description = "프로젝트 이슈 응답")
public record ProjectIssueResponse(
    @Schema(description = "이슈 ID", example = "101") Long id,

    @Schema(description = "이슈 제목", example = "API 응답 정렬 규칙 보완") String title,

    @Schema(description = "이슈 내용") @Nullable String description,

    @Schema(description = "이슈 우선순위", example = "HIGH") ProjectIssuePriority priority,

    @Schema(description = "이슈 상태", example = "IN_PROGRESS") ProjectIssueStatus status,

    @Schema(description = "담당자 사용자 ID", example = "7") @Nullable Long assigneeUserId,

    @Schema(description = "담당자 로그인 ID", example = "kim") @Nullable String assigneeLoginId,

    @Schema(description = "담당자 이름", example = "김개발") @Nullable String assigneeName,

    @Schema(description = "생성 시각") Instant createdAt,

    @Schema(description = "수정 시각") Instant updatedAt
) {
    /**
     * 서비스 결과를 API 응답 DTO로 변환한다.
     *
     * @param result 서비스 결과
     * @return API 응답 DTO
     */
    public static ProjectIssueResponse from(ProjectIssueResult result) {
        return new ProjectIssueResponse(
            result.id(),
            result.title(),
            result.description(),
            result.priority(),
            result.status(),
            result.assigneeUserId(),
            result.assigneeLoginId(),
            result.assigneeName(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
