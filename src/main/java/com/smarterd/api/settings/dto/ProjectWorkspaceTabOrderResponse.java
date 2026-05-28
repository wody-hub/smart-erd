package com.smarterd.api.settings.dto;

import com.smarterd.domain.settings.service.UserSettingService.ProjectWorkspaceTabOrderResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 프로젝트 작업공간 탭 순서 응답.
 *
 * @param tabOrder 저장된 탭 순서
 */
public record ProjectWorkspaceTabOrderResponse(
    @Schema(
        description = "정규화된 프로젝트 작업공간 탭 순서",
        example = "[\"overview\",\"documents\",\"tags\",\"wbs\",\"myTasks\",\"gantt\",\"staffing\",\"issues\"]"
    )
    List<String> tabOrder
) {
    /**
     * 서비스 결과를 응답 DTO로 변환한다.
     *
     * @param result 서비스 결과
     * @return 응답 DTO
     */
    public static ProjectWorkspaceTabOrderResponse from(ProjectWorkspaceTabOrderResult result) {
        return new ProjectWorkspaceTabOrderResponse(result.tabOrder());
    }
}
