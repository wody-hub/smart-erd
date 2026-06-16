package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.lang.Nullable;

/**
 * WBS subtree 복제 요청.
 */
@Schema(description = "WBS subtree 복제 요청")
public record DuplicateWbsSubtreeRequest(
    @Nullable @Schema(description = "복제본이 들어갈 부모 WBS ID. null이면 루트로 복제", example = "200") Long parentId,
    @Schema(description = "담당자 초기화 여부", example = "true") boolean resetAssignee,
    @Schema(description = "일정 초기화 여부", example = "false") boolean resetSchedule,
    @Schema(description = "진척률 초기화 여부", example = "true") boolean resetProgress,
    @Schema(description = "마일스톤 초기화 여부", example = "true") boolean resetMilestone,
    @Schema(description = "subtree 내부 dependency까지 함께 복제할지 여부", example = "true")
    boolean includeDependencies
) {}
