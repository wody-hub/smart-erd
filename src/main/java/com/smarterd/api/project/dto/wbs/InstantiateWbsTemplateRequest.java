package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.lang.Nullable;

/**
 * WBS 템플릿 적용 요청.
 */
@Schema(description = "WBS 템플릿 적용 요청")
public record InstantiateWbsTemplateRequest(
    @Nullable @Schema(description = "적용 대상 부모 WBS ID. null이면 루트에 생성", example = "200") Long parentId,
    @Schema(description = "담당자 초기화 여부", example = "true") boolean resetAssignee,
    @Schema(description = "일정 초기화 여부", example = "false") boolean resetSchedule,
    @Schema(description = "진척률 초기화 여부", example = "true") boolean resetProgress,
    @Schema(description = "마일스톤 초기화 여부", example = "true") boolean resetMilestone,
    @Schema(description = "template 내부 dependency까지 생성할지 여부", example = "true") boolean includeDependencies
) {}
