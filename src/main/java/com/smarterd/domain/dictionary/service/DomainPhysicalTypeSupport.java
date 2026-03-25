package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.lang.Nullable;

/**
 * 도메인 구조화 타입과 표시용 물리 타입 문자열 간 변환을 지원한다.
 */
public final class DomainPhysicalTypeSupport {

    private static final Pattern TYPE_PATTERN = Pattern.compile(
        "^\\s*([A-Za-z0-9_ ]+?)\\s*(?:\\((\\d+)\\s*(?:,\\s*(\\d+))?\\))?\\s*$"
    );

    private DomainPhysicalTypeSupport() {}

    /**
     * 데이터 길이가 필수인 타입인지 판별한다.
     *
     * @param dataType 데이터 타입
     * @return 길이 필수 타입이면 {@code true}
     */
    public static boolean requiresLength(@Nullable String dataType) {
        final var normalized = normalizeNullableTypeName(dataType);
        if (normalized == null) {
            return false;
        }
        return switch (normalized) {
            case "VARCHAR", "CHAR", "CHARACTER", "DECIMAL", "NUMERIC" -> true;
            default -> false;
        };
    }

    /**
     * 데이터 소수점 길이가 데이터 길이를 초과하는지 판별한다.
     *
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @return 초과하면 {@code true}
     */
    public static boolean isScaleExceedsLength(@Nullable Integer dataLength, @Nullable Integer dataScale) {
        return dataLength != null && dataScale != null && dataScale > dataLength;
    }

    /**
     * 구조화 타입 우선, 없으면 레거시 물리 타입 문자열을 파싱해 타입 정보를 해석한다.
     *
     * @param physicalType 레거시 물리 타입 문자열
     * @param dataType 구조화 데이터 타입
     * @param dataLength 구조화 데이터 길이
     * @param dataScale 구조화 데이터 소수점 길이
     * @return 해석된 타입 정보
     */
    public static DomainTypeComponents resolve(
        @Nullable String physicalType,
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        if (AppStringUtils.isNotBlank(dataType)) {
            return fromStructured(dataType, dataLength, dataScale);
        }
        return parse(physicalType);
    }

    /**
     * 구조화 타입을 정규화하고 표시 문자열을 생성한다.
     *
     * @param dataType 구조화 데이터 타입
     * @param dataLength 구조화 데이터 길이
     * @param dataScale 구조화 데이터 소수점 길이
     * @return 정규화된 타입 정보
     */
    public static DomainTypeComponents fromStructured(
        String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale
    ) {
        final var normalizedDataType = normalizeTypeName(dataType);
        final var normalizedLength = normalizePositiveOrNull(dataLength);
        final var normalizedScale = normalizedLength == null ? null : normalizeNonNegativeOrNull(dataScale);
        return new DomainTypeComponents(
            normalizedDataType,
            normalizedLength,
            normalizedScale,
            format(normalizedDataType, normalizedLength, normalizedScale)
        );
    }

    /**
     * 물리 타입 문자열을 구조화 필드로 파싱한다.
     *
     * @param physicalType 물리 타입 문자열
     * @return 파싱 결과
     */
    public static DomainTypeComponents parse(@Nullable String physicalType) {
        final var normalizedPhysicalType = AppStringUtils.trimToNull(physicalType);
        if (normalizedPhysicalType == null) {
            return new DomainTypeComponents(null, null, null, null);
        }

        final var matcher = TYPE_PATTERN.matcher(normalizedPhysicalType);
        if (!matcher.matches()) {
            return new DomainTypeComponents(
                normalizedPhysicalType.toUpperCase(Locale.ROOT),
                null,
                null,
                normalizedPhysicalType
            );
        }

        final var normalizedDataType = normalizeTypeName(matcher.group(1));
        final var dataLength = parseNullableInteger(matcher.group(2));
        final var dataScale = parseNullableInteger(matcher.group(3));
        return new DomainTypeComponents(
            normalizedDataType,
            dataLength,
            dataScale,
            format(normalizedDataType, dataLength, dataScale)
        );
    }

    /**
     * 구조화 타입을 물리 타입 문자열로 포맷한다.
     *
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @return 표시 문자열
     */
    @Nullable
    public static String format(@Nullable String dataType, @Nullable Integer dataLength, @Nullable Integer dataScale) {
        final var normalizedDataType = AppStringUtils.trimToNull(dataType);
        if (normalizedDataType == null) {
            return null;
        }
        final var normalizedLength = normalizePositiveOrNull(dataLength);
        final var normalizedScale = normalizedLength == null ? null : normalizeNonNegativeOrNull(dataScale);

        final var typeName = normalizeTypeName(normalizedDataType);
        if (normalizedLength == null) {
            return typeName;
        }
        if (normalizedScale == null) {
            return typeName + "(" + normalizedLength + ")";
        }
        return typeName + "(" + normalizedLength + "," + normalizedScale + ")";
    }

    @Nullable
    private static Integer parseNullableInteger(@Nullable String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        return Integer.valueOf(normalized);
    }

    private static String normalizeTypeName(String value) {
        return AppStringUtils.trimToEmpty(value).replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    @Nullable
    private static String normalizeNullableTypeName(@Nullable String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        return normalizeTypeName(normalized);
    }

    @Nullable
    private static Integer normalizePositiveOrNull(@Nullable Integer value) {
        if (value == null || value <= 0) {
            return null;
        }
        return value;
    }

    @Nullable
    private static Integer normalizeNonNegativeOrNull(@Nullable Integer value) {
        if (value == null || value < 0) {
            return null;
        }
        return value;
    }

    /**
     * 정규화된 도메인 타입 구성 요소.
     *
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @param physicalType 표시 물리 타입 문자열
     */
    public record DomainTypeComponents(
        @Nullable String dataType,
        @Nullable Integer dataLength,
        @Nullable Integer dataScale,
        @Nullable String physicalType
    ) {}
}
