package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 도메인 벌크 검증 결과에 프리뷰 행과 저장 후보 행을 추가한다.
 */
final class DomainBulkValidationResultAppender {

    /**
     * 검증 결과에 유효/오류 행을 반영한다.
     *
     * @param rowNumber 원본 행 번호
     * @param row 정규화된 행
     * @param logicalName 생성된 표준 도메인명
     * @param dataLength 파싱된 데이터 길이
     * @param dataScale 파싱된 데이터 소수점 길이
     * @param errors 오류 목록
     * @param result 검증 결과
     */
    void addValidationResult(
        int rowNumber,
        NormalizedDomainRow row,
        String logicalName,
        Integer dataLength,
        Integer dataScale,
        List<String> errors,
        DomainBulkValidationResult result
    ) {
        final var data = createPreviewData(row, logicalName);
        final var previewRow = new BulkValidationRowResult(rowNumber, errors.isEmpty(), errors, data);
        if (errors.isEmpty()) {
            result.addValid(
                previewRow,
                new ValidatedDomainRow(rowNumber, createDomainBulkRow(row, logicalName, dataLength, dataScale))
            );
            return;
        }
        result.addError(previewRow, createErrorReportRow(rowNumber, row, logicalName, errors));
    }

    /**
     * 프리뷰용 데이터 맵을 생성한다.
     *
     * @param row 정규화된 행
     * @param logicalName 생성된 표준 도메인명
     * @return 프리뷰 데이터
     */
    private Map<String, String> createPreviewData(NormalizedDomainRow row, String logicalName) {
        final var data = new LinkedHashMap<String, String>();
        data.put("domainGroup", row.domainGroup());
        data.put("domainClassification", row.domainClassification());
        data.put("logicalName", logicalName);
        data.put("dataType", row.dataType());
        data.put("dataLength", row.dataLengthRaw());
        data.put("dataScale", row.dataScaleRaw());
        data.put("description", row.description());
        return data;
    }

    /**
     * 저장 후보 행을 생성한다.
     *
     * @param row 정규화된 행
     * @param logicalName 생성된 표준 도메인명
     * @param dataLength 파싱된 데이터 길이
     * @param dataScale 파싱된 데이터 소수점 길이
     * @return 저장 후보 행
     */
    private DomainBulkRow createDomainBulkRow(
        NormalizedDomainRow row,
        String logicalName,
        Integer dataLength,
        Integer dataScale
    ) {
        return new DomainBulkRow(
            row.domainGroup(),
            row.domainClassification(),
            logicalName,
            row.dataType(),
            dataLength,
            dataScale,
            row.description()
        );
    }

    /**
     * 오류 리포트 행을 생성한다.
     *
     * @param rowNumber 원본 행 번호
     * @param row 정규화된 행
     * @param logicalName 생성된 표준 도메인명
     * @param errors 오류 목록
     * @return 오류 리포트 행
     */
    private DomainBulkErrorReportRow createErrorReportRow(
        int rowNumber,
        NormalizedDomainRow row,
        String logicalName,
        List<String> errors
    ) {
        return new DomainBulkErrorReportRow(
            rowNumber,
            row.domainGroup(),
            row.domainClassification(),
            logicalName,
            row.dataType(),
            row.dataLengthRaw(),
            row.dataScaleRaw(),
            row.description(),
            String.join("\n", errors)
        );
    }
}
