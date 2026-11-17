package com.smarterd.config.websocket;

import com.smarterd.api.common.RequiresEditProtocol;
import com.smarterd.collaboration.CollaborationProtocolPolicy;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 문서 쓰기와 편집 ticket 발급의 공통 REST 프로토콜 게이트를 등록한다. */
@Configuration
@EnableConfigurationProperties(CollaborationProperties.class)
@RequiredArgsConstructor
public class CollaborationProtocolConfig implements WebMvcConfigurer {

    /** 내용을 변경하지 않는 HTTP 메서드. */
    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    /** 공유 프로토콜 정책. */
    private final CollaborationProtocolPolicy policy;

    /**
     * 명시적으로 표시된 API만 검사하여 GET과 기존 비문서 API를 유지한다.
     * @param registry MVC 인터셉터 레지스트리
     */
    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(
            new HandlerInterceptor() {
                /**
                 * 표시된 쓰기 요청의 프로토콜 버전을 검사한다.
                 * @param request HTTP 요청
                 * @param response HTTP 응답
                 * @param handler 선택된 MVC 핸들러
                 * @return 허용된 요청이면 true
                 */
                @Override
                public boolean preHandle(
                    @NonNull HttpServletRequest request,
                    @NonNull HttpServletResponse response,
                    @NonNull Object handler
                ) {
                    if (
                        !READ_METHODS.contains(request.getMethod()) &&
                        handler instanceof HandlerMethod method &&
                        (method.hasMethodAnnotation(RequiresEditProtocol.class) ||
                            method.getBeanType().isAnnotationPresent(RequiresEditProtocol.class))
                    ) {
                        policy.requireEditVersion(
                            policy.restVersion(request.getHeader(CollaborationProtocolPolicy.CLIENT_PROTOCOL_HEADER))
                        );
                    }
                    return true;
                }
            }
        );
    }
}
