package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.service.WbsPlanningService.WbsTemplateSummaryResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.springframework.lang.Nullable;

/**
 * WBS 템플릿 응답.
 */
@Schema(description = "WBS 템플릿 응답")
public record WbsTemplateResponse(
    @Schema(description = "템플릿 ID", example = "1") Long id,
    @Schema(description = "템플릿 이름", example = "기본 운영 wave") String name,
    @Nullable @Schema(description = "설명", example = "반복 사용하는 운영형 작업 골격") String description,
    @Schema(description = "루트 항목 이름", example = "운영 wave") String rootName,
    @Schema(description = "포함 WBS 항목 수", example = "5") int itemCount,
    @Schema(description = "포함 dependency 수", example = "3") int dependencyCount,
    @Schema(description = "생성 시각") Instant createdAt,
    @Schema(description = "수정 시각") Instant updatedAt
) {
    public static WbsTemplateResponse from(WbsTemplateSummaryResult result) {
        return new WbsTemplateResponse(
            result.id(),
            result.name(),
            result.description(),
            result.rootName(),
            result.itemCount(),
            result.dependencyCount(),
            result.createdAt(),
            result.updatedAt()
        );
    }
}
