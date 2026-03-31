package com.smarterd.domain.dictionary.service;

import java.util.List;
import java.util.Map;

/**
 * 사전 벌크 업로드 서비스 계층에서 공통으로 사용하는 결과 모델 모음.
 *
 * <p>HTTP 응답 DTO와 분리하여 domain/service 계층이 api/dto 패키지에 직접 의존하지 않도록 유지한다.</p>
 */
public final class BulkModels {

    private BulkModels() {}

    /**
     * 벌크 업로드 프리뷰의 개별 행 검증 결과.
     *
     * @param rowNumber 원본 엑셀/CSV 행 번호
     * @param valid 유효 여부
     * @param errors 오류 메시지 목록
     * @param data 미리보기용 파싱 데이터
     */
    public record BulkValidationRowResult(
        int rowNumber,
        boolean valid,
        List<String> errors,
        Map<String, String> data
    ) {}

    /**
     * 벌크 업로드 검증 결과.
     *
     * @param validationToken 저장 단계에서 사용할 검증 세션 토큰
     * @param totalCount 전체 행 수
     * @param validCount 유효 행 수
     * @param errorCount 오류 행 수
     * @param previewTruncated 미리보기가 일부만 반환되었는지 여부
     * @param rows 미리보기 행 목록
     */
    public record BulkValidationResult(
        String validationToken,
        int totalCount,
        int validCount,
        int errorCount,
        boolean previewTruncated,
        List<BulkValidationRowResult> rows
    ) {}

    /**
     * 벌크 저장 결과.
     *
     * @param savedCount 저장 성공 건수
     * @param failedCount 저장 실패 건수
     */
    public record BulkSaveResult(int savedCount, int failedCount) {}
}
