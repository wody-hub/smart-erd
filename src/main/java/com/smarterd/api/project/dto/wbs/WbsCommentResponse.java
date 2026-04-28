package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkCommentResult;
import java.time.Instant;

/**
 * WBS 댓글 응답.
 */
public record WbsCommentResponse(
    Long id,
    String content,
    String actorLoginId,
    String actorName,
    Instant createdAt,
    Instant updatedAt
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
