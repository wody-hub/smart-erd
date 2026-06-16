package com.smarterd.domain.dictionary.service;

import java.time.Instant;
import java.util.List;

/**
 * 도메인 벌크 검증 세션 저장 모델.
 *
 * @param loginId 사용자 로그인 ID
 * @param teamId 팀 ID
 * @param setId 사전 세트 ID
 * @param expiresAt 만료 시각
 * @param validRows 검증 통과 행
 * @param errorRows 검증 실패 행
 * @param saveConsumed 저장 소비 여부
 */
record DomainBulkValidationSession(
    String loginId,
    Long teamId,
    Long setId,
    Instant expiresAt,
    List<ValidatedDomainRow> validRows,
    List<DomainBulkErrorReportRow> errorRows,
    boolean saveConsumed
) implements BulkValidationSessionExpirable, BulkValidationSessionOwnership {}
