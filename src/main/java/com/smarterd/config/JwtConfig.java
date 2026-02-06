package com.smarterd.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * JWT 인코더/디코더 빈 설정.
 *
 * <p>{@code application.yml}의 {@code smart-erd.jwt.secret}(Base64 인코딩된 대칭키)을 사용하여
 * HMAC-SHA256 기반의 JWT 서명 및 검증을 구성한다.
 * Spring Security OAuth2 Resource Server의 {@link JwtDecoder}로 토큰 검증이 자동 수행된다.</p>
 */
@Configuration
public class JwtConfig {

    /**
     * JWT 프로퍼티를 {@code application.yml}의 {@code smart-erd.jwt} 접두사로 바인딩한다.
     *
     * @return JwtProperties 인스턴스
     */
    @Bean
    @ConfigurationProperties(prefix = "smart-erd.jwt")
    public JwtProperties jwtProperties() {
        return new JwtProperties();
    }

    /**
     * Nimbus 기반 JWT 인코더를 생성한다.
     *
     * @param jwtProperties JWT 설정 프로퍼티
     * @return HMAC-SHA256 대칭키를 사용하는 JwtEncoder
     */
    @Bean
    public JwtEncoder jwtEncoder(JwtProperties jwtProperties) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(jwtProperties)));
    }

    /**
     * Nimbus 기반 JWT 디코더를 생성한다.
     *
     * <p>Spring Security OAuth2 Resource Server가 Bearer 토큰 검증 시 이 디코더를 사용한다.</p>
     *
     * @param jwtProperties JWT 설정 프로퍼티
     * @return HMAC-SHA256 서명을 검증하는 JwtDecoder
     */
    @Bean
    public JwtDecoder jwtDecoder(JwtProperties jwtProperties) {
        return NimbusJwtDecoder.withSecretKey(secretKey(jwtProperties)).macAlgorithm(MacAlgorithm.HS256).build();
    }

    /**
     * Base64 인코딩된 시크릿으로부터 HMAC-SHA256 키를 생성한다.
     *
     * @param jwtProperties JWT 설정 프로퍼티
     * @return HMAC-SHA256 SecretKey
     */
    private SecretKey secretKey(JwtProperties jwtProperties) {
        final var keyBytes = Base64.getDecoder().decode(jwtProperties.getSecret());
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }
}
