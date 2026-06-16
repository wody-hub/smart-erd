package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * WBS 댓글 작성 요청.
 */
@Schema(description = "WBS 댓글 작성 요청")
public record CreateWbsCommentRequest(
    @Schema(description = "댓글 내용", example = "산출물 리뷰가 필요합니다.")
    @NotBlank(message = "{validation.not-blank.content}")
    @Size(max = 4000, message = "{validation.size.work-comment-content}")
    String content
) {}
