package com.smarterd.config;

import lombok.Getter;
import lombok.Setter;

/**
 * JWT 설정 프로퍼티.
 *
 * <p>{@code application.yml}의 {@code smart-erd.jwt.*} 프로퍼티와 바인딩된다.</p>
 */
@Getter
@Setter
public class JwtProperties {

    /** 개발 환경 전용 기본 시크릿 (프로덕션에서는 반드시 환경 변수로 대체해야 한다) */
    static final String DEV_DEFAULT_SECRET =
        "c21hcnQtZXJkLWp3dC1zZWNyZXQta2V5LXRoYXQtaXMtbG9uZy1lbm91Z2gtZm9yLWhtYWMtc2hhMjU2";

    /** Base64 인코딩된 HMAC-SHA256 서명 키 */
    private String secret;

    /** Access Token 만료 시간 (밀리초) */
    private long accessExpiration;

    /** Refresh Token 만료 시간 (밀리초) */
    private long refreshExpiration;

    /**
     * 현재 설정된 시크릿이 개발 환경 기본값인지 확인한다.
     *
     * @return 기본값이면 true
     */
    public boolean isUsingDefaultSecret() {
        return DEV_DEFAULT_SECRET.equals(secret);
    }
}
