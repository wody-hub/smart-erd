package com.smarterd.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

/**
 * JWT 설정 프로퍼티.
 *
 * <p>{@code application.yml}의 {@code smart-erd.jwt.*} 프로퍼티와 바인딩된다.</p>
 */
@Getter
@Setter
public class JwtProperties {

    private static final Logger log = LoggerFactory.getLogger(JwtProperties.class);

    /** 개발 환경 전용 기본 시크릿 (프로덕션에서는 반드시 환경 변수로 대체해야 한다) */
    static final String DEV_DEFAULT_SECRET =
        "c21hcnQtZXJkLWp3dC1zZWNyZXQta2V5LXRoYXQtaXMtbG9uZy1lbm91Z2gtZm9yLWhtYWMtc2hhMjU2";

    /** Spring Environment (프로파일 확인용) */
    @Setter
    private Environment environment;

    /** Base64 인코딩된 HMAC-SHA256 서명 키 */
    private String secret;

    /** Access Token 만료 시간 (밀리초) */
    private long accessExpiration;

    /** Refresh Token 만료 시간 (밀리초) */
    private long refreshExpiration;

    /**
     * 프로덕션 프로파일에서 기본 시크릿 사용 시 경고 로그를 출력한다.
     */
    @PostConstruct
    void validateSecret() {
        if (isUsingDefaultSecret()) {
            final var profiles = environment.getActiveProfiles();
            for (final var profile : profiles) {
                if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                    log.warn(
                        "프로덕션 환경에서 기본 JWT 시크릿을 사용하고 있습니다. " +
                            "SMART_ERD_JWT_SECRET 환경 변수를 반드시 설정하세요."
                    );
                    return;
                }
            }
            log.info("개발 환경 기본 JWT 시크릿을 사용 중입니다.");
        }
    }

    /**
     * 현재 설정된 시크릿이 개발 환경 기본값인지 확인한다.
     *
     * @return 기본값이면 true
     */
    public boolean isUsingDefaultSecret() {
        return DEV_DEFAULT_SECRET.equals(secret);
    }
}
