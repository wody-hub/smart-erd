package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 도메인 벌크 업로드 행의 정규화와 숫자 파싱을 담당한다.
 */
final class DomainBulkRowParser {

    private final BulkMessageResolver messageResolver;

    /**
     * @param messageResolver 메시지 해석 함수
     */
    DomainBulkRowParser(BulkMessageResolver messageResolver) {
        this.messageResolver = messageResolver;
    }

    /**
     * 파싱된 행 값을 정규화한다.
     *
     * @param row 파싱된 행
     * @return 정규화된 행
     */
    NormalizedDomainRow normalizeRow(Map<String, String> row) {
        return new NormalizedDomainRow(
            AppStringUtils.trimToEmpty(row.getOrDefault("domainGroup", "")),
            AppStringUtils.trimToEmpty(row.getOrDefault("domainClassification", "")),
            AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", "")),
            AppStringUtils.trimToEmpty(row.getOrDefault("dataType", "")),
            AppStringUtils.trimToEmpty(row.getOrDefault("dataLength", "")),
            AppStringUtils.trimToEmpty(row.getOrDefault("dataScale", "")),
            AppStringUtils.trimToEmpty(row.getOrDefault("description", ""))
        );
    }

    /**
     * 기존 중복 조회용 표준 도메인명을 해석한다.
     *
     * @param row 파싱된 행
     * @return 표준 도메인명
     */
    String resolveRowLogicalName(Map<String, String> row) {
        final var domainClassification = AppStringUtils.trimToNull(row.getOrDefault("domainClassification", ""));
        final var logicalName = AppStringUtils.trimToNull(row.getOrDefault("logicalName", ""));
        final var dataType = AppStringUtils.trimToNull(row.getOrDefault("dataType", ""));
        final var dataLength = parseIntegerQuietly(row.getOrDefault("dataLength", ""));
        final var dataScale = parseIntegerQuietly(row.getOrDefault("dataScale", ""));
        return AppStringUtils.defaultIfBlank(
            DomainLogicalNameSupport.resolve(logicalName, domainClassification, dataType, dataLength, dataScale),
            ""
        );
    }

    /**
     * 양수 정수를 파싱한다.
     *
     * @param value 원본 값
     * @param errors 오류 목록
     * @param locale 요청 로케일
     * @param errorCode 오류 메시지 코드
     * @return 파싱된 정수
     */
    Integer parsePositiveInteger(String value, List<String> errors, Locale locale, String errorCode) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            final var parsed = Integer.parseInt(normalized);
            if (parsed <= 0) {
                errors.add(msg(errorCode, locale));
                return null;
            }
            return parsed;
        } catch (NumberFormatException e) {
            errors.add(msg(errorCode, locale));
            return null;
        }
    }

    /**
     * 0 이상 정수를 파싱한다.
     *
     * @param value 원본 값
     * @param errors 오류 목록
     * @param locale 요청 로케일
     * @param errorCode 오류 메시지 코드
     * @return 파싱된 정수
     */
    Integer parseNonNegativeInteger(String value, List<String> errors, Locale locale, String errorCode) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            final var parsed = Integer.parseInt(normalized);
            if (parsed < 0) {
                errors.add(msg(errorCode, locale));
                return null;
            }
            return parsed;
        } catch (NumberFormatException e) {
            errors.add(msg(errorCode, locale));
            return null;
        }
    }

    /**
     * 정수를 조용히 파싱한다.
     *
     * @param value 원본 값
     * @return 파싱된 정수
     */
    private Integer parseIntegerQuietly(String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
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
