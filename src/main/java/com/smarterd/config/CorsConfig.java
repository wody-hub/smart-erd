package com.smarterd.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * CORS(Cross-Origin Resource Sharing) 설정.
 *
 * <p>{@code application.yml}의 {@code cors} 프로퍼티로부터 허용 Origin, Method, Header 등을 읽어
 * 환경별로 다른 CORS 정책을 적용할 수 있다.</p>
 */
@Configuration
public class CorsConfig {

    /**
     * CORS 프로퍼티를 {@code application.yml}의 {@code cors} 접두사로 바인딩한다.
     *
     * @return CorsProperties 인스턴스
     */
    @Bean
    @ConfigurationProperties(prefix = "smart-erd.cors")
    public CorsProperties corsProperties() {
        return new CorsProperties();
    }

    /**
     * CORS 설정 소스를 생성한다.
     *
     * <p>{@link CorsProperties}에서 읽은 값으로 CORS 정책을 구성한다.</p>
     *
     * @param corsProperties CORS 프로퍼티
     * @return URL 기반 CORS 설정 소스
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(CorsProperties corsProperties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.getAllowedOrigins());
        configuration.setAllowedMethods(corsProperties.getAllowedMethods());
        configuration.setAllowedHeaders(corsProperties.getAllowedHeaders());
        configuration.setAllowCredentials(corsProperties.isAllowCredentials());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * CORS 설정 프로퍼티.
     *
     * <p>{@code application.yml}의 {@code smart-erd.cors.*} 프로퍼티와 바인딩된다.</p>
     */
    @Getter
    @Setter
    public static class CorsProperties {

        /** 허용할 Origin 목록 */
        private List<String> allowedOrigins = List.of();

        /** 허용할 HTTP 메서드 목록 */
        private List<String> allowedMethods = List.of();

        /** 허용할 헤더 목록 */
        private List<String> allowedHeaders = List.of("*");

        /** 자격 증명(쿠키, Authorization 헤더) 허용 여부 */
        private boolean allowCredentials = true;
    }
}
