package com.smarterd.api.project.dto.wbs;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * WBS 댓글 작성 요청.
 */
public record CreateWbsCommentRequest(
    @NotBlank(message = "{validation.not-blank.content}") @Size(
        max = 4000,
        message = "{validation.size.work-comment-content}"
    ) String content
) {}
