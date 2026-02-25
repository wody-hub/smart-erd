package com.smarterd.config.security;

import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 인증 보안 설정 프로퍼티.
 *
 * <p>{@code application.yml}의 {@code smart-erd.auth.*} 프로퍼티와 바인딩된다.</p>
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "smart-erd.auth")
public class AuthSecurityProperties {

    /** 로그인 Rate Limiting 설정 */
    private LoginRateLimit loginRateLimit = new LoginRateLimit();
    /** 클라이언트 IP 추출 설정 */
    private ClientIp clientIp = new ClientIp();
    /** CSP(Content Security Policy) 설정 */
    private Csp csp = new Csp();
    /** Refresh Token 정리 스케줄 설정 */
    private RefreshTokenCleanup refreshTokenCleanup = new RefreshTokenCleanup();

    /**
     * 로그인 Rate Limiting 설정값.
     */
    @Getter
    @Setter
    public static class LoginRateLimit {

        /** 윈도우 내 허용 실패 횟수 */
        private int maxFailedAttempts = 5;

        /** 실패 횟수 카운팅 윈도우(초) */
        private long windowSeconds = 60;

        /** 제한 초과 시 차단 시간(초) */
        private long blockSeconds = 300;

        /** 오래된 상태 정리 주기(밀리초) */
        private long cleanupIntervalMillis = 600000L;

        /** 상태 보존 기간(초) */
        private long staleRetentionSeconds = 3600L;
    }

    /**
     * 클라이언트 IP 추출 설정값.
     */
    @Getter
    @Setter
    public static class ClientIp {

        /** 기본 trusted proxy CIDR 목록 */
        public static final List<String> DEFAULT_TRUSTED_PROXY_CIDRS = List.of("127.0.0.1/32", "::1/128");

        /** 전달 헤더를 신뢰할 프록시 CIDR 목록 */
        private List<String> trustedProxyCidrs = DEFAULT_TRUSTED_PROXY_CIDRS;
    }

    /**
     * CSP 설정값.
     */
    @Getter
    @Setter
    public static class Csp {

        /** connect-src에 추가할 출처 목록 */
        private List<String> connectSources = List.of();
    }

    /**
     * Refresh Token 정리 스케줄 설정값.
     */
    @Getter
    @Setter
    public static class RefreshTokenCleanup {

        /** 만료 토큰 정리 주기(밀리초) */
        private long cleanupIntervalMillis = 3600000L;

        /** consume 완료 토큰 보관 기간(초) */
        private long consumedRetentionSeconds = 86400L;
    }
}
