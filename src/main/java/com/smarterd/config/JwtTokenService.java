package com.smarterd.config;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * JWT 토큰 생성 서비스.
 *
 * <p>Spring Security의 {@link JwtEncoder}를 사용하여 HS256 서명된 JWT 토큰을 발급한다.
 * 토큰의 subject에 사용자의 로그인 ID를 저장한다.</p>
 */
@Service
public class JwtTokenService {

    /** JWT 인코더 */
    private final JwtEncoder jwtEncoder;

    /** 토큰 만료 시간 (밀리초) */
    private final long expiration;

    /**
     * JwtTokenService를 생성한다.
     *
     * @param jwtEncoder JWT 인코더 빈
     * @param expiration 토큰 만료 시간(ms) ({@code smart-erd.jwt.expiration})
     */
    public JwtTokenService(JwtEncoder jwtEncoder, @Value("${smart-erd.jwt.expiration}") long expiration) {
        this.jwtEncoder = jwtEncoder;
        this.expiration = expiration;
    }

    /**
     * 지정된 로그인 ID에 대한 JWT 토큰을 생성한다.
     *
     * <p>토큰 구성:
     * <ul>
     *   <li>{@code sub}: 로그인 ID</li>
     *   <li>{@code iat}: 현재 시각</li>
     *   <li>{@code exp}: 현재 시각 + 만료 시간</li>
     *   <li>서명 알고리즘: HS256</li>
     * </ul></p>
     *
     * @param loginId 토큰 subject에 저장할 로그인 ID
     * @return 서명된 JWT 토큰 문자열
     */
    public String generateToken(String loginId) {
        Instant now = Instant.now();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .subject(loginId)
            .issuedAt(now)
            .expiresAt(now.plusMillis(expiration))
            .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
