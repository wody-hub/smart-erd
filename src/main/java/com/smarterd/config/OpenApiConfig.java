package com.smarterd.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI(Swagger) 설정.
 *
 * <p>Swagger UI에서 JWT Bearer 토큰을 사용한 인증 테스트를 지원한다.
 * Authorize 버튼을 통해 토큰을 입력하면 이후 모든 요청에 자동으로 첨부된다.</p>
 */
@Configuration
public class OpenApiConfig {

    /**
     * OpenAPI 스펙을 구성한다.
     *
     * @return JWT Bearer 인증이 포함된 OpenAPI 설정
     */
    @Bean
    OpenAPI openAPI() {
        String securitySchemeName = "Bearer Authentication";

        return new OpenAPI()
            .info(
                new Info().title("Smart ERD API").description("Smart ERD 애플리케이션 REST API 문서").version("0.0.1")
            )
            .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
            .components(
                new Components().addSecuritySchemes(
                    securitySchemeName,
                    new SecurityScheme()
                        .name(securitySchemeName)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                )
            );
    }
}
