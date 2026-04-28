package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsDocumentService.DocumentTagResult;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 프로젝트 문서 태그 요약 응답.
 */
@Schema(description = "프로젝트 문서 태그 요약")
public record WbsDocumentTagResponse(
    @Schema(description = "태그", example = "spec") String tag,
    @Schema(description = "태그가 붙은 문서 수", example = "3") long documentCount
) {
    public static WbsDocumentTagResponse from(DocumentTagResult result) {
        return new WbsDocumentTagResponse(result.tag(), result.documentCount());
    }
}
