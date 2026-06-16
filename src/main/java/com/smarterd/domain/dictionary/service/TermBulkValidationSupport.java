package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 용어 벌크 업로드 행 검증을 담당한다.
 */
final class TermBulkValidationSupport {

    private static final int PHYSICAL_NAME_MAX = 100;

    private final BulkMessageResolver messageResolver;

    /**
     * @param messageResolver 메시지 해석 함수
     */
    TermBulkValidationSupport(BulkMessageResolver messageResolver) {
        this.messageResolver = messageResolver;
    }

    /**
     * 모든 행을 순회하며 필드 검증, 도메인 참조 검사, 중복 검사를 수행한다.
     *
     * @param rawRows 파싱된 행 목록
     * @param domainMap 사전 세트 내 도메인 논리명 맵
     * @param locale 요청 로케일
     * @return 검증 결과
     */
    TermBulkValidationResult validateRows(
        List<Map<String, String>> rawRows,
        Map<String, Domain> domainMap,
        Locale locale
    ) {
        final var seenNames = new HashSet<String>();
        final var result = new TermBulkValidationResult(rawRows.size());

        for (var i = 0; i < rawRows.size(); i++) {
            validateRow(rawRows.get(i), i + 2, seenNames, domainMap, locale, result);
        }
        return result;
    }

    /**
     * 단일 행을 검증하고 결과에 반영한다.
     *
     * @param row 파싱된 행
     * @param rowNumber 원본 행 번호
     * @param seenNames 파일 내 이미 등장한 논리명 집합
     * @param domainMap 사전 세트 내 도메인 논리명 맵
     * @param locale 요청 로케일
     * @param result 검증 결과 누적 객체
     */
    private void validateRow(
        Map<String, String> row,
        int rowNumber,
        Set<String> seenNames,
        Map<String, Domain> domainMap,
        Locale locale,
        TermBulkValidationResult result
    ) {
        final var logicalName = AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", ""));
        final var physicalName = AppStringUtils.trimToEmpty(row.getOrDefault("physicalName", ""));
        final var domainLogicalName = AppStringUtils.trimToEmpty(row.getOrDefault("domainLogicalName", ""));
        final var description = AppStringUtils.trimToEmpty(row.getOrDefault("description", ""));
        final var errors = validateSingleRow(
            logicalName,
            physicalName,
            domainLogicalName,
            description,
            seenNames,
            domainMap,
            locale
        );
        final var data = validationPreviewData(logicalName, physicalName, domainLogicalName, description);
        final var previewRow = new BulkValidationRowResult(rowNumber, errors.isEmpty(), errors, data);
        addValidationResult(
            rowNumber,
            logicalName,
            physicalName,
            domainLogicalName,
            description,
            errors,
            previewRow,
            result
        );
    }

    /**
     * 프리뷰 응답 데이터를 생성한다.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param domainLogicalName 도메인 논리명
     * @param description 설명
     * @return 프리뷰 데이터
     */
    private Map<String, String> validationPreviewData(
        String logicalName,
        String physicalName,
        String domainLogicalName,
        String description
    ) {
        final var data = new LinkedHashMap<String, String>();
        data.put("logicalName", logicalName);
        data.put("physicalName", physicalName);
        data.put("domainLogicalName", domainLogicalName);
        data.put("description", description);
        return data;
    }

    /**
     * 단일 용어 행의 필드 검증, 도메인 참조 검사, 중복 검사를 수행한다.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param domainLogicalName 도메인 논리명
     * @param description 설명
     * @param seenNames 파일 내 이미 등장한 논리명 집합
     * @param domainMap 사전 세트 내 도메인 논리명 맵
     * @param locale 요청 로케일
     * @return 에러 메시지 목록
     */
    private List<String> validateSingleRow(
        String logicalName,
        String physicalName,
        String domainLogicalName,
        String description,
        Set<String> seenNames,
        Map<String, Domain> domainMap,
        Locale locale
    ) {
        final var errors = new ArrayList<String>();
        validateRequiredAndLength(logicalName, physicalName, description, errors, locale);
        validateDomainReference(domainLogicalName, domainMap, errors, locale);
        validateDuplicate(logicalName, seenNames, errors, locale);
        return errors;
    }

    /**
     * 필수 값과 문자열 길이를 검증한다.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param description 설명
     * @param errors 오류 목록
     * @param locale 요청 로케일
     */
    private void validateRequiredAndLength(
        String logicalName,
        String physicalName,
        String description,
        List<String> errors,
        Locale locale
    ) {
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
        if (AppStringUtils.isBlank(physicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_REQUIRED.code(), locale));
        } else if (physicalName.length() > PHYSICAL_NAME_MAX) {
            errors.add(
                msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_MAX_LENGTH.code(), locale, PHYSICAL_NAME_MAX)
            );
        }
        if (description.length() > AbstractBulkService.DESCRIPTION_MAX) {
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
     * 도메인 참조 존재 여부를 검증한다.
     *
     * @param domainLogicalName 도메인 논리명
     * @param domainMap 사전 세트 내 도메인 논리명 맵
     * @param errors 오류 목록
     * @param locale 요청 로케일
     */
    private void validateDomainReference(
        String domainLogicalName,
        Map<String, Domain> domainMap,
        List<String> errors,
        Locale locale
    ) {
        if (AppStringUtils.isNotBlank(domainLogicalName) && !domainMap.containsKey(domainLogicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DOMAIN_NOT_FOUND.code(), locale, domainLogicalName));
        }
    }

    /**
     * 파일 내 중복을 검증한다.
     *
     * @param logicalName 논리명
     * @param seenNames 파일 내 이미 등장한 논리명 집합
     * @param errors 오류 목록
     * @param locale 요청 로케일
     */
    private void validateDuplicate(String logicalName, Set<String> seenNames, List<String> errors, Locale locale) {
        if (AppStringUtils.isNotBlank(logicalName) && !seenNames.add(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_FILE.code(), locale, logicalName));
        }
    }

    /**
     * 검증 결과를 누적한다.
     *
     * @param rowNumber 원본 행 번호
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param domainLogicalName 도메인 논리명
     * @param description 설명
     * @param errors 오류 목록
     * @param previewRow 프리뷰 행
     * @param result 검증 결과 누적 객체
     */
    private void addValidationResult(
        int rowNumber,
        String logicalName,
        String physicalName,
        String domainLogicalName,
        String description,
        List<String> errors,
        BulkValidationRowResult previewRow,
        TermBulkValidationResult result
    ) {
        if (errors.isEmpty()) {
            result.addValid(
                previewRow,
                new ValidatedTermRow(
                    rowNumber,
                    new TermBulkRow(logicalName, physicalName, domainLogicalName, description)
                )
            );
            return;
        }
        result.addError(
            previewRow,
            new TermBulkErrorReportRow(
                rowNumber,
                logicalName,
                physicalName,
                domainLogicalName,
                description,
                String.join("\n", errors)
            )
        );
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
