package com.smarterd.config.support;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import org.springframework.core.env.Environment;
import org.springframework.lang.Nullable;

/**
 * Spring 활성 프로파일 enum.
 *
 * <p>프로파일 값({@code prod}, {@code dev}, {@code local} 등)과
 * 의미 그룹(운영/개발)을 함께 관리한다.</p>
 */
public enum EnvironmentProfile {
    PROD("prod", ProfileGroup.PRODUCTION),
    PRODUCTION("production", ProfileGroup.PRODUCTION),
    STG("stg", ProfileGroup.PRODUCTION),
    DEV("dev", ProfileGroup.DEVELOPMENT),
    DEVELOPMENT("development", ProfileGroup.DEVELOPMENT),
    LOCAL("local", ProfileGroup.DEVELOPMENT),
    TEST("test", ProfileGroup.DEVELOPMENT);

    private final String value;
    private final ProfileGroup group;

    EnvironmentProfile(String value, ProfileGroup group) {
        this.value = value;
        this.group = group;
    }

    /**
     * enum에 매핑된 프로파일 문자열 값을 반환한다.
     *
     * @return 프로파일 문자열
     */
    public String value() {
        return value;
    }

    /**
     * 운영 그룹 프로파일인지 확인한다.
     *
     * @return 운영 그룹이면 true
     */
    public boolean isProduction() {
        return group == ProfileGroup.PRODUCTION;
    }

    /**
     * 개발 그룹 프로파일인지 확인한다.
     *
     * @return 개발 그룹이면 true
     */
    public boolean isDevelopment() {
        return group == ProfileGroup.DEVELOPMENT;
    }

    /**
     * 프로파일 문자열을 enum으로 변환한다.
     *
     * @param profileName 프로파일 문자열
     * @return 매핑된 enum (미일치 시 empty)
     */
    public static Optional<EnvironmentProfile> from(String profileName) {
        final var normalized = profileName.toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
            .filter((profile) -> profile.value.equals(normalized))
            .findFirst();
    }

    /**
     * 활성 프로파일에 운영 그룹이 포함되었는지 확인한다.
     *
     * @param environment Spring 환경 정보
     * @return 운영 그룹 활성 여부
     */
    public static boolean hasProductionProfile(@Nullable Environment environment) {
        return hasGroupProfile(environment, ProfileGroup.PRODUCTION);
    }

    /**
     * 활성 프로파일에 개발 그룹이 포함되었는지 확인한다.
     *
     * @param environment Spring 환경 정보
     * @return 개발 그룹 활성 여부
     */
    public static boolean hasDevelopmentProfile(@Nullable Environment environment) {
        return hasGroupProfile(environment, ProfileGroup.DEVELOPMENT);
    }

    /**
     * 활성 프로파일에 대상 그룹이 포함되었는지 확인한다.
     *
     * @param environment Spring 환경 정보
     * @param targetGroup 대상 프로파일 그룹
     * @return 대상 그룹 활성 여부
     */
    private static boolean hasGroupProfile(@Nullable Environment environment, ProfileGroup targetGroup) {
        if (environment == null) {
            return false;
        }

        return Arrays.stream(environment.getActiveProfiles())
            .map(EnvironmentProfile::from)
            .flatMap(Optional::stream)
            .anyMatch((profile) -> profile.group == targetGroup);
    }

    /** 프로파일 의미 그룹 */
    private enum ProfileGroup {
        PRODUCTION,
        DEVELOPMENT,
    }
}
