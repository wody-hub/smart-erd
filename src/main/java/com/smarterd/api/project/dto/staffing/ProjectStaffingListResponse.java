package com.smarterd.api.project.dto.staffing;

import com.smarterd.domain.pm.staffing.service.ProjectStaffingService.ProjectStaffingListResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 프로젝트 인력 투입 목록 응답 DTO.
 */
@Schema(description = "프로젝트 인력 투입 목록 응답")
public record ProjectStaffingListResponse(
    @Schema(description = "멤버별 인력 투입 목록") List<ProjectStaffingResourceResponse> resources,

    @Schema(description = "프로젝트 인력 합계") ProjectStaffingSummaryResponse summary,

    @Schema(description = "월별 매트릭스 컬럼 목록(yyyy-MM)") List<String> months
) {
    public static ProjectStaffingListResponse from(ProjectStaffingListResult result) {
        return new ProjectStaffingListResponse(
            result.resources().stream().map(ProjectStaffingResourceResponse::from).toList(),
            ProjectStaffingSummaryResponse.from(result.summary()),
            result.months()
        );
    }
}
