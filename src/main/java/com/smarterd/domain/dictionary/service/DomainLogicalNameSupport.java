package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import org.springframework.lang.Nullable;

/**
 * 표준 도메인명 규칙을 지원한다.
 *
 * <p>기본 규칙은 길이 또는 정밀도가 중요한 타입만 표준 도메인명에 반영한다.
 * {@code VARCHAR}/{@code CHAR}는 {@code V}/{@code C}+길이,
 * {@code DECIMAL}/{@code NUMERIC}은 전체 타입명+정밀도 표기를 사용한다.
 * 그 외 고정형 타입은 도메인명만 사용한다.</p>
 */
public final class DomainLogicalNameSupport {

    private DomainLogicalNameSupport() {}

    /**
     * 도메인명과 구조화 타입을 바탕으로 표준 도메인명을 생성한다.
     *
     * @param domainName 도메인명
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @return 생성된 표준 도메인명, 생성 불가 시 {@code null}
     */
    @Nullable
    public static String format(
        @Nullable String domainName,
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        final var normalizedDomainName = normalizeDomainName(domainName);
        if (AppStringUtils.isBlank(normalizedDomainName) || AppStringUtils.isBlank(dataType)) {
            return null;
        }

        final var typeComponents = DomainPhysicalTypeSupport.fromStructured(dataType, dataLength, dataScale);
        if (
            DomainPhysicalTypeSupport.requiresLength(typeComponents.dataType()) && typeComponents.dataLength() == null
        ) {
            return null;
        }
        final var suffixText = buildTypeSuffix(
            typeComponents.dataType(),
            typeComponents.dataLength(),
            typeComponents.dataScale()
        );
        if (suffixText == null) {
            return normalizedDomainName;
        }
        if (endsWithTypeSuffix(normalizedDomainName, suffixText)) {
            return normalizedDomainName;
        }
        return normalizedDomainName + "_" + suffixText;
    }

    /**
     * 표준 도메인명을 해석한다. 도메인명이 주어지면 규칙형 이름을 우선 생성하고,
     * 생성할 수 없으면 전달받은 기존 이름을 그대로 사용한다.
     *
     * @param logicalName 기존 표준 도메인명
     * @param domainName 도메인명
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @return 최종 표준 도메인명
     */
    @Nullable
    public static String resolve(
        @Nullable String logicalName,
        @Nullable String domainName,
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        final var generated = format(domainName, dataType, dataLength, dataScale);
        if (generated != null) {
            return generated;
        }
        return AppStringUtils.trimToNull(logicalName);
    }

    /**
     * 표준 도메인명에서 원래 도메인명을 추론한다.
     *
     * @param logicalName 표준 도메인명
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @return 추론된 도메인명, 없으면 {@code null}
     */
    @Nullable
    public static String inferDomainName(
        @Nullable String logicalName,
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        final var normalizedLogicalName = AppStringUtils.trimToNull(logicalName);
        if (normalizedLogicalName == null) {
            return null;
        }

        final var suffixText = buildTypeSuffix(dataType, dataLength, dataScale);
        if (suffixText == null) {
            return normalizedLogicalName;
        }

        final var expectedSuffix = "_" + suffixText;
        if (
            normalizedLogicalName.length() > expectedSuffix.length() &&
            AppStringUtils.endsWithIgnoreCase(normalizedLogicalName, expectedSuffix)
        ) {
            return normalizedLogicalName.substring(0, normalizedLogicalName.length() - expectedSuffix.length());
        }

        return normalizedLogicalName;
    }

    @Nullable
    private static String normalizeDomainName(@Nullable String domainName) {
        final var normalized = AppStringUtils.trimToNull(domainName);
        if (normalized == null) {
            return null;
        }
        return normalized.replaceAll("\\s+", "");
    }

    private static boolean endsWithTypeSuffix(String domainName, String suffix) {
        return AppStringUtils.endsWithIgnoreCase(domainName, "_" + suffix);
    }

    @Nullable
    private static String buildTypeSuffix(
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        final var typeNotation = normalizeTypeNotation(dataType);
        if (typeNotation == null) {
            return null;
        }
        if (DomainPhysicalTypeSupport.requiresLength(dataType) && dataLength == null) {
            return null;
        }

        final var suffix = new StringBuilder(typeNotation);
        if (dataLength != null) {
            suffix.append(dataLength);
        }
        if (dataScale != null) {
            suffix.append("_").append(dataScale);
        }
        return suffix.toString();
    }

    @Nullable
    private static String normalizeTypeNotation(@Nullable String dataType) {
        final var normalized = AppStringUtils.trimToNull(dataType);
        if (normalized == null) {
            return null;
        }
        final var upperCased = AppStringUtils.upperCaseToEmpty(normalized);
        if ("VARCHAR".equals(upperCased)) {
            return "V";
        }
        if ("CHAR".equals(upperCased) || "CHARACTER".equals(upperCased)) {
            return "C";
        }
        if ("DECIMAL".equals(upperCased) || "NUMERIC".equals(upperCased)) {
            return upperCased;
        }
        return null;
    }
}
