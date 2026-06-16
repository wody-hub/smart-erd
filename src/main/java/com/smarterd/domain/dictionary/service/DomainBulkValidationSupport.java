package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 도메인 벌크 업로드 행 검증을 담당한다.
 */
final class DomainBulkValidationSupport {

    private static final int DOMAIN_GROUP_MAX = 100;
    private static final int DOMAIN_CLASSIFICATION_MAX = 100;
    private static final int DATA_TYPE_MAX = 50;

    private final BulkMessageResolver messageResolver;
    private final DomainBulkRowParser rowParser;
    private final DomainBulkValidationResultAppender resultAppender = new DomainBulkValidationResultAppender();

    /**
     * @param messageResolver 메시지 해석 함수
     */
    DomainBulkValidationSupport(BulkMessageResolver messageResolver) {
        this.messageResolver = messageResolver;
        this.rowParser = new DomainBulkRowParser(messageResolver);
    }

    /**
     * 모든 행을 순회하며 필드 검증, 중복 검사를 수행한다.
     *
     * @param rawRows 파싱된 행 목록
     * @param existingNames DB에 이미 존재하는 표준 도메인명 집합
     * @param locale 요청 로케일
     * @return 검증 결과
     */
    DomainBulkValidationResult validateRows(
        List<Map<String, String>> rawRows,
        Set<String> existingNames,
        Locale locale
    ) {
        final var seenNames = new HashSet<String>();
        final var result = new DomainBulkValidationResult(rawRows.size());

        for (var i = 0; i < rawRows.size(); i++) {
            validateRow(rawRows.get(i), i + 2, seenNames, existingNames, locale, result);
        }
        return result;
    }

    /**
     * 기존 중복 조회용 표준 도메인명을 해석한다.
     *
     * @param row 파싱된 행
     * @return 표준 도메인명
     */
    String resolveRowLogicalName(Map<String, String> row) {
        return rowParser.resolveRowLogicalName(row);
    }

    /**
     * 단일 행을 검증하고 결과에 반영한다.
     *
     * @param row 파싱된 행
     * @param rowNumber 원본 행 번호
     * @param seenNames 파일 내 등장한 표준 도메인명 집합
     * @param existingNames DB에 존재하는 표준 도메인명 집합
     * @param locale 요청 로케일
     * @param result 검증 결과 누적 객체
     */
    private void validateRow(
        Map<String, String> row,
        int rowNumber,
        Set<String> seenNames,
        Set<String> existingNames,
        Locale locale,
        DomainBulkValidationResult result
    ) {
        final var normalized = rowParser.normalizeRow(row);
        final var errors = new ArrayList<String>();
        final var dataLength = rowParser.parsePositiveInteger(
            normalized.dataLengthRaw(),
            errors,
            locale,
            MessageCode.ERROR_BULK_VALIDATION_DATA_LENGTH_INVALID.code()
        );
        final var dataScale = rowParser.parseNonNegativeInteger(
            normalized.dataScaleRaw(),
            errors,
            locale,
            MessageCode.ERROR_BULK_VALIDATION_DATA_SCALE_INVALID.code()
        );
        final var generatedLogicalName = AppStringUtils.trimToEmpty(
            DomainLogicalNameSupport.resolve(
                normalized.logicalName(),
                normalized.domainClassification(),
                normalized.dataType(),
                dataLength,
                dataScale
            )
        );

        errors.addAll(
            validateSingleRow(normalized, generatedLogicalName, dataLength, dataScale, seenNames, existingNames, locale)
        );
        resultAppender.addValidationResult(
            rowNumber,
            normalized,
            generatedLogicalName,
            dataLength,
            dataScale,
            errors,
            result
        );
    }

    /**
     * 단일 도메인 행의 필드 검증과 중복 검사를 수행한다.
     *
     * @param row 정규화된 행
     * @param logicalName 생성된 표준 도메인명
     * @param dataLength 파싱된 데이터 길이
     * @param dataScale 파싱된 데이터 소수점 길이
     * @param seenNames 파일 내 등장한 표준 도메인명 집합
     * @param existingNames DB에 존재하는 표준 도메인명 집합
     * @param locale 요청 로케일
     * @return 에러 메시지 목록
     */
    private List<String> validateSingleRow(
        NormalizedDomainRow row,
        String logicalName,
        Integer dataLength,
        Integer dataScale,
        Set<String> seenNames,
        Set<String> existingNames,
        Locale locale
    ) {
        final var errors = new ArrayList<String>();
        validateLengths(row, logicalName, errors, locale);
        validateStructuredType(row, dataLength, dataScale, errors, locale);
        validateDuplicate(logicalName, seenNames, existingNames, errors, locale);
        return errors;
    }

    /**
     * 문자열 길이와 필수 값을 검증한다.
     *
     * @param row 정규화된 행
     * @param logicalName 생성된 표준 도메인명
     * @param errors 오류 목록
     * @param locale 요청 로케일
     */
    private void validateLengths(NormalizedDomainRow row, String logicalName, List<String> errors, Locale locale) {
        if (row.domainGroup().length() > DOMAIN_GROUP_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DOMAIN_GROUP_MAX_LENGTH.code(), locale, DOMAIN_GROUP_MAX));
        }
        if (row.domainClassification().length() > DOMAIN_CLASSIFICATION_MAX) {
            errors.add(
                msg(
                    MessageCode.ERROR_BULK_VALIDATION_DOMAIN_CLASSIFICATION_MAX_LENGTH.code(),
                    locale,
                    DOMAIN_CLASSIFICATION_MAX
                )
            );
        }
        if (AppStringUtils.isBlank(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_REQUIRED.code(), locale));
        } else if (logicalName.length() > AbstractBulkService.LOGICAL_NAME_MAX) {
            errors.add(
                msg(
                    MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_MAX_LENGTH.code(),
                    locale,
                    AbstractBulkService.LOGICAL_NAME_MAX
                )
            );
        }
        if (AppStringUtils.isBlank(row.dataType())) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_TYPE_REQUIRED.code(), locale));
        } else if (row.dataType().length() > DATA_TYPE_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_TYPE_MAX_LENGTH.code(), locale, DATA_TYPE_MAX));
        }
        if (row.description().length() > AbstractBulkService.DESCRIPTION_MAX) {
            errors.add(
                msg(
                    MessageCode.ERROR_BULK_VALIDATION_DESCRIPTION_MAX_LENGTH.code(),
                    locale,
                    AbstractBulkService.DESCRIPTION_MAX
                )
            );
        }
    }

    /**
     * 구조화 타입 길이/소수점 규칙을 검증한다.
     *
     * @param row 정규화된 행
     * @param dataLength 파싱된 데이터 길이
     * @param dataScale 파싱된 데이터 소수점 길이
     * @param errors 오류 목록
     * @param locale 요청 로케일
     */
    private void validateStructuredType(
        NormalizedDomainRow row,
        Integer dataLength,
        Integer dataScale,
        List<String> errors,
        Locale locale
    ) {
        if (DomainPhysicalTypeSupport.requiresLength(row.dataType()) && dataLength == null) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_LENGTH_REQUIRED_FOR_TYPE.code(), locale));
        }
        if (AppStringUtils.isNotBlank(row.dataScaleRaw()) && AppStringUtils.isBlank(row.dataLengthRaw())) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_SCALE_REQUIRES_LENGTH.code(), locale));
        }
        if (DomainPhysicalTypeSupport.isScaleExceedsLength(dataLength, dataScale)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_SCALE_INVALID.code(), locale));
        }
    }

    /**
     * 파일 내/DB 중복을 검증한다.
     *
     * @param logicalName 표준 도메인명
     * @param seenNames 파일 내 등장한 표준 도메인명 집합
     * @param existingNames DB에 존재하는 표준 도메인명 집합
     * @param errors 오류 목록
     * @param locale 요청 로케일
     */
    private void validateDuplicate(
        String logicalName,
        Set<String> seenNames,
        Set<String> existingNames,
        List<String> errors,
        Locale locale
    ) {
        if (AppStringUtils.isNotBlank(logicalName) && !seenNames.add(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_FILE.code(), locale, logicalName));
        }
        if (AppStringUtils.isNotBlank(logicalName) && existingNames.contains(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_DB.code(), locale, logicalName));
        }
    }

    /**
     * 메시지를 해석한다.
     *
     * @param code 메시지 코드
     * @param locale 로케일
     * @param args 메시지 인자
     * @return 메시지
     */
    private String msg(String code, Locale locale, Object... args) {
        return messageResolver.resolve(code, locale, args);
    }
}
