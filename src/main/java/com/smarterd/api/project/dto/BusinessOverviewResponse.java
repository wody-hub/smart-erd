package com.smarterd.api.project.dto;

import com.smarterd.domain.project.service.BusinessOverviewResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 사업 개요 응답 DTO.
 *
 * @param projectId         프로젝트 ID
 * @param projectName       프로젝트 이름
 * @param clientCompany     발주사
 * @param contractorCompany 수주사
 * @param contractAmount    계약 금액 (원 단위)
 * @param projectStartDate  프로젝트 시작일
 * @param projectEndDate    프로젝트 종료일
 * @param projectScope      사업 범위
 * @param memberCount       팀 멤버 수
 * @param documentCount     문서(다이어그램) 수
 * @param progressRate      진행률 (WBS 평균 진척률, WBS 항목이 없으면 null)
 */
@Schema(description = "프로젝트 사업 개요 응답")
public record BusinessOverviewResponse(
    /** 프로젝트 ID */
    @Schema(description = "프로젝트 ID", example = "1") Long projectId,

    /** 프로젝트 이름 */
    @Schema(description = "프로젝트 이름", example = "SI 구축 프로젝트") String projectName,

    /** 발주사 */
    @Nullable @Schema(description = "발주사", example = "고객사 A") String clientCompany,

    /** 수주사 */
    @Nullable @Schema(description = "수주사", example = "우리 회사") String contractorCompany,

    /** 계약 금액 */
    @Nullable @Schema(description = "계약 금액 (원 단위)", example = "300000000") Long contractAmount,

    /** 프로젝트 시작일 */
    @Nullable @Schema(description = "프로젝트 시작일", example = "2026-04-14") LocalDate projectStartDate,

    /** 프로젝트 종료일 */
    @Nullable @Schema(description = "프로젝트 종료일", example = "2026-10-31") LocalDate projectEndDate,

    /** 사업 범위 */
    @Nullable @Schema(description = "사업 범위", example = "기획, 설계, 개발, 테스트, 운영 전환") String projectScope,

    /** 팀 멤버 수 */
    @Schema(description = "팀 멤버 수", example = "5") long memberCount,

    /** 문서(다이어그램) 수 */
    @Schema(description = "문서(다이어그램) 수", example = "12") long documentCount,

    /** 진행률 */
    @Nullable @Schema(description = "WBS 평균 진척률 (WBS 항목이 없으면 null)", example = "72") Integer progressRate
) {
    /**
     * 서비스 계층 결과를 응답 DTO로 변환한다.
     *
     * @param result 서비스 계층 사업 개요 결과
     * @return 사업 개요 응답 DTO
     */
    public static BusinessOverviewResponse from(BusinessOverviewResult result) {
        return new BusinessOverviewResponse(
            result.projectId(),
            result.projectName(),
            result.clientCompany(),
            result.contractorCompany(),
            result.contractAmount(),
            result.projectStartDate(),
            result.projectEndDate(),
            result.projectScope(),
            result.memberCount(),
            result.documentCount(),
            result.progressRate()
        );
    }
}
