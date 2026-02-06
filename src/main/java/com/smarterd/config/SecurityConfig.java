package com.smarterd.config;

import lombok.RequiredArgsConstructor;
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
 *   <li>{@code /api/auth/**} — 로그인·회원가입</li>
 *   <li>{@code /h2-console/**} — H2 데이터베이스 콘솔</li>
 * </ul></p>
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    /** CORS 설정 소스 */
    private final CorsConfigurationSource corsConfigurationSource;

    /**
     * HTTP 보안 필터 체인을 구성한다.
     *
     * <p>CSRF 비활성화, Stateless 세션, H2 콘솔 iframe 허용,
     * OAuth2 Resource Server JWT 검증을 설정한다.</p>
     *
     * @param http HttpSecurity 빌더
     * @return 구성된 SecurityFilterChain
     * @throws Exception 설정 중 예외 발생 시
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));

        return http.build();
    }

    /**
     * BCrypt 비밀번호 인코더를 빈으로 등록한다.
     *
     * @return BCryptPasswordEncoder 인스턴스
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
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
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}
