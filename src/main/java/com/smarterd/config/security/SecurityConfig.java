package com.smarterd.config.security;

import com.smarterd.utils.AppStringUtils;
import java.util.LinkedHashSet;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Spring Security 설정.
 *
 * <p>Stateless JWT 기반 인증을 구성한다.
 * OAuth2 Resource Server의 내장 {@code BearerTokenAuthenticationFilter}를 사용하여
 * Authorization 헤더의 Bearer 토큰을 자동으로 검증한다.</p>
 *
 * <p>공개 경로:
 * <ul>
 *   <li>{@code /api/auth/**} — 로그인·회원가입·토큰 갱신·로그아웃</li>
 *   <li>{@code /swagger-ui/**, /v3/api-docs/**} — Swagger UI 및 OpenAPI 스펙</li>
 *   <li>{@code /ws/diagram/**} — WebSocket 엔드포인트 (JWT 인증은 핸드셰이크 인터셉터에서 처리)</li>
 * </ul></p>
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(AuthSecurityProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    /** CORS 설정 소스 */
    private final CorsConfigurationSource corsConfigurationSource;
    /** 인증 보안 프로퍼티 */
    private final AuthSecurityProperties authSecurityProperties;

    /**
     * HTTP 보안 필터 체인을 구성한다.
     *
     * <p>CSRF 비활성화, Stateless 세션, 보안 헤더(CSP, X-Frame-Options, X-Content-Type-Options),
     * OAuth2 Resource Server JWT 검증을 설정한다.</p>
     *
     * @param http HttpSecurity 빌더
     * @return 구성된 SecurityFilterChain
     * @throws Exception 설정 중 예외 발생 시
     */
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        final var cspPolicy = resolveCspPolicy();
        http
            .cors((cors) -> cors.configurationSource(corsConfigurationSource))
            .csrf((csrf) -> csrf.disable())
            .sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers((headers) ->
                headers
                    // [ZAP] CSP — XSS/인젝션 방어 + frame-ancestors로 클릭재킹 방어
                    .contentSecurityPolicy((csp) -> csp.policyDirectives(cspPolicy))
                    // [ZAP] X-Frame-Options: DENY — 구형 브라우저 클릭재킹 방어
                    .frameOptions((frame) -> frame.deny())
                    // [ZAP] X-Content-Type-Options: nosniff — MIME-sniffing 방어 (Spring Security 기본값 유지)
                    .contentTypeOptions(Customizer.withDefaults())
                    // [ZAP] HSTS — HTTPS 연결에서만 헤더가 적용된다.
                    .httpStrictTransportSecurity((hsts) -> hsts.maxAgeInSeconds(31536000).includeSubDomains(true))
            )
            .authorizeHttpRequests((auth) ->
                auth
                    .requestMatchers("/api/auth/**")
                    .permitAll()
                    .requestMatchers("/swagger-ui/**", "/v3/api-docs/**")
                    .permitAll()
                    .requestMatchers("/ws/diagram/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .oauth2ResourceServer((oauth2) -> oauth2.jwt(Customizer.withDefaults()));

        return http.build();
    }

    /**
     * BCrypt 비밀번호 인코더를 빈으로 등록한다.
     *
     * @return BCryptPasswordEncoder 인스턴스
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * 인증 관리자를 빈으로 노출한다.
     *
     * <p>Spring Boot가 {@code UserDetailsService}와 {@code PasswordEncoder} 빈을 감지하여
     * {@code DaoAuthenticationProvider}를 자동 구성한다.
     * {@link AuthenticationConfiguration}에서 완성된 {@link AuthenticationManager}를 가져온다.</p>
     *
     * @param authenticationConfiguration Spring Security 인증 설정
     * @return 자동 구성된 AuthenticationManager
     * @throws Exception 인증 관리자 조회 중 예외 발생 시
     */
    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
        throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    /**
     * 설정 기반으로 CSP 정책 문자열을 구성한다.
     *
     * @return CSP policyDirectives 값
     */
    private String resolveCspPolicy() {
        final var connectSources = new LinkedHashSet<String>();
        connectSources.add("'self'");
        authSecurityProperties
            .getCsp()
            .getConnectSources()
            .forEach((origin) -> addConnectSource(connectSources, origin));
        return (
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "font-src 'self'; " +
            "connect-src " +
            String.join(" ", connectSources) +
            "; " +
            "frame-ancestors 'none'"
        );
    }

    /**
     * 설정된 connect source를 CSP connect-src 집합에 추가한다.
     *
     * @param connectSources connect-src 대상 집합
     * @param source connect source 문자열
     */
    private void addConnectSource(LinkedHashSet<String> connectSources, String source) {
        final var normalizedSource = AppStringUtils.trimToNull(source);
        if (normalizedSource == null) {
            return;
        }
        connectSources.add(normalizedSource);
    }
}
