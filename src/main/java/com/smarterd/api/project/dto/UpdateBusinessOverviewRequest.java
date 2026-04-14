package com.smarterd.api.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 사업 개요 수정 요청 DTO.
 *
 * @param clientCompany     발주사 (선택, 최대 200자)
 * @param contractorCompany 수주사 (선택, 최대 200자)
 * @param contractAmount    계약 금액 (선택, 0 이상)
 * @param projectStartDate  프로젝트 시작일 (선택)
 * @param projectEndDate    프로젝트 종료일 (선택)
 * @param projectScope      사업 범위 (선택)
 */
@Schema(description = "프로젝트 사업 개요 수정 요청")
public record UpdateBusinessOverviewRequest(
    @Nullable
    @Schema(description = "발주사", example = "고객사 A")
    @Size(max = 200, message = "{validation.size.client-company}")
    String clientCompany,

    @Nullable
    @Schema(description = "수주사", example = "우리 회사")
    @Size(max = 200, message = "{validation.size.contractor-company}")
    String contractorCompany,

    @Nullable
    @Schema(description = "계약 금액 (원 단위)", example = "300000000")
    @Min(value = 0, message = "{validation.min.contract-amount}")
    Long contractAmount,

    @Nullable @Schema(description = "프로젝트 시작일", example = "2026-04-14") LocalDate projectStartDate,

    @Nullable @Schema(description = "프로젝트 종료일", example = "2026-10-31") LocalDate projectEndDate,

    @Nullable @Schema(description = "사업 범위", example = "기획, 설계, 개발, 테스트, 운영 전환") String projectScope
) {
    /**
     * 프로젝트 시작일/종료일은 모두 입력하거나 모두 비워야 한다.
     *
     * @return 날짜 쌍 정합성 여부
     */
    @AssertTrue(message = "{validation.project-period.pair-required}")
    public boolean isProjectPeriodPairValid() {
        return (projectStartDate == null) == (projectEndDate == null);
    }
}
