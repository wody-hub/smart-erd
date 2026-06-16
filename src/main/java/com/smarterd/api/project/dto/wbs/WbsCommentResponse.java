package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkCommentResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * WBS 댓글 응답.
 */
@Schema(description = "WBS 댓글 응답")
public record WbsCommentResponse(
    @Schema(description = "댓글 ID", example = "1001") Long id,
    @Schema(description = "댓글 내용", example = "산출물 리뷰가 필요합니다.") String content,
    @Schema(description = "작성자 로그인 ID", example = "kim") String actorLoginId,
    @Schema(description = "작성자 이름", example = "김개발") String actorName,
    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,
    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static WbsCommentResponse from(WorkCommentResult result) {
        return new WbsCommentResponse(
            result.id(),
            result.content(),
            result.actorLoginId(),
            result.actorName(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
