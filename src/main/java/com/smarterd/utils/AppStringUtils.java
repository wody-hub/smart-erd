package com.smarterd.utils;

import java.util.Locale;
import org.apache.commons.lang3.StringUtils;
import org.springframework.lang.Nullable;

/**
 * 애플리케이션 공통 문자열 유틸리티.
 *
 * <p>기본 문자열 처리는 Apache Commons {@link StringUtils}를 사용하고,
 * 프로젝트에서 반복되는 규칙을 공통 메서드로 제공한다.</p>
 */
public final class AppStringUtils {

    private AppStringUtils() {}

    /**
     * 문자열을 trim 한 뒤 빈 문자열이면 {@code null}을 반환한다.
     *
     * @param value 원본 문자열
     * @return trim 결과 또는 {@code null}
     */
    @Nullable
    public static String trimToNull(@Nullable String value) {
        return StringUtils.trimToNull(value);
    }

    /**
     * 문자열을 trim 한 뒤 {@code null}이면 빈 문자열을 반환한다.
     *
     * @param value 원본 문자열
     * @return trim 결과(널 안전)
     */
    public static String trimToEmpty(@Nullable String value) {
        return StringUtils.trimToEmpty(value);
    }

    /**
     * 문자열이 {@code null}, 빈 문자열, 공백만 포함하면 {@code true}를 반환한다.
     *
     * @param value 검사 대상 문자열
     * @return blank 여부
     */
    public static boolean isBlank(@Nullable String value) {
        return StringUtils.isBlank(value);
    }

    /**
     * 문자열이 공백 외 문자를 하나 이상 포함하면 {@code true}를 반환한다.
     *
     * @param value 검사 대상 문자열
     * @return non-blank 여부
     */
    public static boolean isNotBlank(@Nullable String value) {
        return StringUtils.isNotBlank(value);
    }

    /**
     * 문자열이 blank이면 기본값을 반환한다.
     *
     * @param value 원본 문자열
     * @param defaultValue 기본값
     * @return 원본 문자열 또는 기본값
     */
    @Nullable
    public static String defaultIfBlank(@Nullable String value, @Nullable String defaultValue) {
        return StringUtils.defaultIfBlank(value, defaultValue);
    }

    /**
     * 문자열이 지정 접두사로 시작하는지 확인한다.
     *
     * @param value 원본 문자열
     * @param prefix 접두사
     * @return 접두사 일치 여부
     */
    public static boolean startsWith(@Nullable String value, @Nullable String prefix) {
        return StringUtils.startsWith(value, prefix);
    }

    /**
     * 문자열이 동일한지(대소문자 무시) 확인한다.
     *
     * @param left 비교 대상 문자열 1
     * @param right 비교 대상 문자열 2
     * @return 대소문자 무시 동등 여부
     */
    public static boolean equalsIgnoreCase(@Nullable String left, @Nullable String right) {
        return StringUtils.equalsIgnoreCase(left, right);
    }

    /**
     * 문자열에 검색 문자열이 포함되는지(대소문자 무시) 확인한다.
     *
     * @param value 원본 문자열
     * @param search 검색 문자열
     * @return 포함 여부
     */
    public static boolean containsIgnoreCase(@Nullable String value, @Nullable String search) {
        return StringUtils.containsIgnoreCase(value, search);
    }

    /**
     * 문자열을 trim 후 소문자로 정규화한다.
     *
     * @param value 원본 문자열
     * @return trim+lower 결과 또는 {@code null}
     */
    @Nullable
    public static String lowerTrimToNull(@Nullable String value) {
        final var trimmed = trimToNull(value);
        return trimmed == null ? null : StringUtils.lowerCase(trimmed, Locale.ROOT);
    }

    /**
     * 문자열을 trim 후 소문자로 정규화하고, null이면 빈 문자열을 반환한다.
     *
     * @param value 원본 문자열
     * @return trim+lower 결과(널 안전)
     */
    public static String lowerTrimToEmpty(@Nullable String value) {
        return StringUtils.defaultString(lowerTrimToNull(value));
    }

    /**
     * 문자열이 지정 접미사로 끝나는지(대소문자 무시) 확인한다.
     *
     * @param value 원본 문자열
     * @param suffix 접미사
     * @return 접미사 일치 여부
     */
    public static boolean endsWithIgnoreCase(@Nullable String value, @Nullable String suffix) {
        return StringUtils.endsWithIgnoreCase(value, suffix);
    }

    /**
     * 문자열이 지정 접미사 목록 중 하나로 끝나는지(대소문자 무시) 확인한다.
     *
     * @param value 원본 문자열
     * @param suffixes 접미사 목록
     * @return 접미사 목록 중 하나라도 일치하면 {@code true}
     */
    public static boolean endsWithAnyIgnoreCase(@Nullable String value, @Nullable String... suffixes) {
        if (value == null || suffixes == null || suffixes.length == 0) {
            return false;
        }
        for (final var suffix : suffixes) {
            if (endsWithIgnoreCase(value, suffix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * CSV 문자열의 첫 토큰을 trim 규칙으로 반환한다.
     *
     * @param value 콤마 구분 문자열
     * @return 첫 토큰 또는 {@code null}
     */
    @Nullable
    public static String firstCsvTokenToNull(@Nullable String value) {
        final var normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        return trimToNull(StringUtils.substringBefore(normalized, ","));
    }
}
