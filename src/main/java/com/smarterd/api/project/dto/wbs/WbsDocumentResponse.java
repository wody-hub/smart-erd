package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsDocumentService.LinkedDocumentResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import org.springframework.lang.Nullable;

/**
 * WBS 연계/태그 조회용 문서 응답.
 */
@Schema(description = "WBS 문서 응답")
public record WbsDocumentResponse(
    @Schema(description = "문서 ID", example = "42") Long id,
    @Schema(description = "문서 이름", example = "API Spec") String name,
    @Schema(description = "문서 플러그인 ID", example = "markdown") String pluginId,
    @Nullable @Schema(description = "markdown 템플릿 키", example = "technical-spec") String templateKey,
    @Nullable @Schema(description = "markdown 템플릿 표시 이름", example = "Technical Spec") String templateLabel,
    @Nullable @Schema(description = "문서 요약", example = "Describe the goal and scope.") String summaryText,
    @Schema(description = "문서 태그") List<String> tags,
    @Nullable @Schema(description = "WBS 연결 시각 (UTC, ISO-8601)") Instant linkedAt,
    @Schema(description = "문서 생성 시각 (UTC, ISO-8601)") Instant createdAt,
    @Schema(description = "문서 수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static WbsDocumentResponse from(LinkedDocumentResult result) {
        return new WbsDocumentResponse(
            result.id(),
            result.name(),
            result.pluginId(),
            result.templateKey(),
            result.templateLabel(),
            result.summaryText(),
            result.tags(),
            result.linkedAt(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
