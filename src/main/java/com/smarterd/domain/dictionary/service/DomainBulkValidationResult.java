package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 도메인 벌크 행 검증 결과를 누적하고 응답/세션 모델로 변환한다.
 */
final class DomainBulkValidationResult {

    private static final int PREVIEW_ROW_LIMIT = 2_000;

    private final ArrayList<BulkValidationRowResult> errorPreviewRows;
    private final ArrayList<BulkValidationRowResult> validPreviewRows;
    private final ArrayList<ValidatedDomainRow> validRows = new ArrayList<>();
    private final ArrayList<DomainBulkErrorReportRow> errorRows = new ArrayList<>();
    private int validCount = 0;
    private int errorCount = 0;

    /**
     * @param estimatedSize 예상 행 수
     */
    DomainBulkValidationResult(int estimatedSize) {
        this.errorPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
        this.validPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
    }

    /**
     * 유효 행을 누적한다.
     *
     * @param previewRow 프리뷰 행
     * @param validatedRow 저장 후보 행
     */
    void addValid(BulkValidationRowResult previewRow, ValidatedDomainRow validatedRow) {
        validCount++;
        validRows.add(validatedRow);
        if (validPreviewRows.size() < PREVIEW_ROW_LIMIT) {
            validPreviewRows.add(previewRow);
        }
    }

    /**
     * 오류 행을 누적한다.
     *
     * @param previewRow 프리뷰 행
     * @param errorReportRow 오류 리포트 행
     */
    void addError(BulkValidationRowResult previewRow, DomainBulkErrorReportRow errorReportRow) {
        errorCount++;
        errorRows.add(errorReportRow);
        if (errorPreviewRows.size() < PREVIEW_ROW_LIMIT) {
            errorPreviewRows.add(previewRow);
        }
    }

    /**
     * 검증 세션 모델로 변환한다.
     *
     * @param loginId 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param expiresAt 만료 시각
     * @return 검증 세션 모델
     */
    DomainBulkValidationSession toSession(String loginId, Long teamId, Long setId, Instant expiresAt) {
        return new DomainBulkValidationSession(
            loginId,
            teamId,
            setId,
            expiresAt,
            List.copyOf(validRows),
            List.copyOf(errorRows),
            false
        );
    }

    /**
     * API 응답용 벌크 검증 결과로 변환한다.
     *
     * @param validationToken 검증 토큰
     * @param totalRows 전체 행 수
     * @return 벌크 검증 응답
     */
    BulkValidationResult toResponse(String validationToken, int totalRows) {
        final var previewRows = BulkValidationPreviewSupport.mergePreviewRows(
            errorPreviewRows,
            validPreviewRows,
            PREVIEW_ROW_LIMIT
        );
        return new BulkValidationResult(
            validationToken,
            totalRows,
            validCount,
            errorCount,
            totalRows > previewRows.size(),
            previewRows
        );
    }
}
