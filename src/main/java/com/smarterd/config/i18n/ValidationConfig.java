package com.smarterd.config.i18n;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * Bean Validation과 MessageSource를 연결하는 설정.
 *
 * <p>{@code @NotBlank(message = "{validation.key}")} 형태의 메시지 키를
 * {@code messages.properties}에서 다국어로 해석할 수 있게 한다.</p>
 */
@Configuration
public class ValidationConfig {

    /**
     * MessageSource를 유효성 검증 메시지 소스로 연결한 LocalValidatorFactoryBean을 등록한다.
     *
     * @param messageSource Spring 메시지 소스
     * @return LocalValidatorFactoryBean 빈
     */
    @Bean
    public LocalValidatorFactoryBean validator(@NonNull MessageSource messageSource) {
        final var bean = new LocalValidatorFactoryBean();
        bean.setValidationMessageSource(messageSource);
        return bean;
    }
}
