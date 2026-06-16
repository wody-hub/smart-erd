package com.smarterd.api.settings.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 프로젝트 작업공간 탭 순서 저장 요청.
 *
 * @param tabOrder 원하는 탭 순서
 */
@Schema(description = "프로젝트 작업공간 탭 순서 저장 요청")
public record ProjectWorkspaceTabOrderRequest(
    @Schema(
        description = "사용자별 프로젝트 작업공간 탭 순서",
        example = "[\"documents\",\"overview\",\"tags\",\"wbs\",\"myTasks\",\"gantt\",\"staffing\",\"issues\"]"
    )
    @NotNull(message = "{validation.not-null.project-workspace-tab-order}")
    List<@Size(min = 1, max = 32, message = "{validation.size.project-workspace-tab-key}") String> tabOrder
) {}
