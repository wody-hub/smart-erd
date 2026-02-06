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

    /** Base64 인코딩된 HMAC-SHA256 서명 키 */
    private String secret;

    /** 토큰 만료 시간 (밀리초) */
    private long expiration;
}
