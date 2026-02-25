package com.smarterd.utils;

import com.smarterd.config.security.AuthSecurityProperties;
import com.smarterd.config.support.EnvironmentProfile;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.core.env.Environment;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

/**
 * 클라이언트 IP 추출 유틸리티.
 *
 * <p>리버스 프록시 환경에서 주로 사용하는 헤더를 우선 확인하고,
 * 없으면 서블릿 remote address를 반환한다.</p>
 */
@Slf4j
@Component
public class ClientIpUtils {

    private static final String X_FORWARDED_FOR_HEADER = "X-Forwarded-For";
    private static final String X_REAL_IP_HEADER = "X-Real-IP";

    private final List<IpAddressMatcher> trustedProxyMatchers;

    /**
     * 클라이언트 IP 추출 유틸리티를 생성한다.
     *
     * @param authSecurityProperties 인증 보안 설정
     * @param environment Spring 환경 정보
     */
    public ClientIpUtils(AuthSecurityProperties authSecurityProperties, Environment environment) {
        final var properties = Objects.requireNonNull(
            authSecurityProperties,
            "authSecurityProperties must not be null"
        );
        final var nonNullEnvironment = Objects.requireNonNull(environment, "environment must not be null");
        final var trustedProxyCidrs = properties
            .getClientIp()
            .getTrustedProxyCidrs()
            .stream()
            .filter((cidr) -> cidr != null && !cidr.isBlank())
            .map(String::trim)
            .collect(Collectors.toUnmodifiableList());
        validateTrustedProxyConfiguration(nonNullEnvironment, trustedProxyCidrs);
        final var invalidCidrs = new ArrayList<String>();

        trustedProxyMatchers = trustedProxyCidrs
            .stream()
            .map((cidr) -> toMatcherSafely(cidr, invalidCidrs))
            .filter(Objects::nonNull)
            .collect(Collectors.toUnmodifiableList());
        validateTrustedProxyMatcherConfiguration(nonNullEnvironment, invalidCidrs);
    }

    /**
     * HTTP 요청에서 클라이언트 IP를 추출한다.
     *
     * @param request HTTP 요청
     * @return 클라이언트 IP 문자열
     */
    public String resolveClientIp(HttpServletRequest request) {
        final var nonNullRequest = Objects.requireNonNull(request, "request must not be null");
        final var remoteAddr = trimToNull(nonNullRequest.getRemoteAddr());
        if (remoteAddr == null) {
            return "unknown";
        }

        // 신뢰 가능한 프록시 구간에서만 전달 헤더를 신뢰한다.
        if (isTrustedProxy(remoteAddr)) {
            final var forwardedFor = extractFirstIp(nonNullRequest.getHeader(X_FORWARDED_FOR_HEADER));
            if (forwardedFor != null) {
                return forwardedFor;
            }

            final var realIp = trimToNull(nonNullRequest.getHeader(X_REAL_IP_HEADER));
            if (realIp != null) {
                return realIp;
            }
        }

        return remoteAddr;
    }

    /**
     * X-Forwarded-For 헤더에서 첫 번째 클라이언트 IP를 추출한다.
     *
     * @param forwardedFor X-Forwarded-For 헤더 원문
     * @return 추출된 첫 번째 IP, 유효 값이 없으면 {@code null}
     */
    @Nullable
    private String extractFirstIp(@Nullable String forwardedFor) {
        final var headerValue = trimToNull(forwardedFor);
        if (headerValue == null) {
            return null;
        }
        final var first = headerValue.split(",")[0];
        return trimToNull(first);
    }

    /**
     * 문자열을 trim 후 비어 있으면 {@code null}로 변환한다.
     *
     * @param value 원본 문자열
     * @return trim된 문자열 또는 {@code null}
     */
    @Nullable
    private String trimToNull(@Nullable String value) {
        if (value == null) {
            return null;
        }
        final var trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * remote address가 신뢰 가능한 프록시 대역인지 확인한다.
     *
     * @param remoteAddr 원격 주소 문자열
     * @return 신뢰 가능한 프록시 대역이면 {@code true}
     */
    private boolean isTrustedProxy(String remoteAddr) {
        return trustedProxyMatchers.stream().anyMatch((matcher) -> matcher.matches(remoteAddr));
    }

    /**
     * CIDR 문자열을 안전하게 {@link IpAddressMatcher}로 변환한다.
     *
     * @param cidr CIDR 문자열
     * @return 변환된 matcher, 파싱 실패 시 {@code null}
     */
    @Nullable
    private IpAddressMatcher toMatcherSafely(String cidr, List<String> invalidCidrs) {
        try {
            return new IpAddressMatcher(cidr);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid trusted proxy CIDR ignored: {}", cidr);
            invalidCidrs.add(cidr);
            return null;
        }
    }

    /**
     * 운영 프로파일에서 trusted proxy CIDR 필수 설정을 검증한다.
     *
     * @param environment Spring 환경 정보
     * @param trustedProxyCidrs trusted proxy CIDR 목록
     */
    private void validateTrustedProxyConfiguration(Environment environment, List<String> trustedProxyCidrs) {
        if (!EnvironmentProfile.hasProductionProfile(environment)) {
            return;
        }
        if (trustedProxyCidrs.isEmpty()) {
            throw new IllegalStateException("trusted-proxy-cidrs must be configured in production profile");
        }
        if (new HashSet<>(trustedProxyCidrs).equals(new HashSet<>(AuthSecurityProperties.ClientIp.DEFAULT_TRUSTED_PROXY_CIDRS))) {
            throw new IllegalStateException("default trusted-proxy-cidrs are not allowed in production profile");
        }
    }

    /**
     * 운영 프로파일에서 CIDR 파싱 실패를 검증한다.
     *
     * @param environment Spring 환경 정보
     * @param invalidCidrs 파싱에 실패한 CIDR 목록
     */
    private void validateTrustedProxyMatcherConfiguration(Environment environment, List<String> invalidCidrs) {
        if (!EnvironmentProfile.hasProductionProfile(environment)) {
            return;
        }
        if (!invalidCidrs.isEmpty()) {
            throw new IllegalStateException("invalid trusted-proxy-cidrs configured in production profile: " + invalidCidrs);
        }
        if (trustedProxyMatchers.isEmpty()) {
            throw new IllegalStateException("trusted-proxy-cidrs resolved to empty matcher set in production profile");
        }
    }
}
