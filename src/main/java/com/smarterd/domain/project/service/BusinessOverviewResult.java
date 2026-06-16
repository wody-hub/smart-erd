package com.smarterd.domain.project.service;

import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 사업 개요 응답용 서비스 결과.
 *
 * @param projectId 프로젝트 ID
 * @param projectName 프로젝트 이름
 * @param clientCompany 발주사
 * @param contractorCompany 수주사
 * @param contractAmount 계약 금액
 * @param projectStartDate 프로젝트 시작일
 * @param projectEndDate 프로젝트 종료일
 * @param projectScope 사업 범위
 * @param memberCount 프로젝트 팀 멤버 수
 * @param documentCount 프로젝트 문서(다이어그램) 수
 * @param progressRate 진행률 (WBS 평균 진척률, WBS 항목이 없으면 null)
 */
public record BusinessOverviewResult(
    Long projectId,
    String projectName,
    @Nullable String clientCompany,
    @Nullable String contractorCompany,
    @Nullable Long contractAmount,
    @Nullable LocalDate projectStartDate,
    @Nullable LocalDate projectEndDate,
    @Nullable String projectScope,
    long memberCount,
    long documentCount,
    @Nullable Integer progressRate
) {}
