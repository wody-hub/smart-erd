package com.smarterd.config;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Accept-Language 헤더 기반 로케일 설정.
 *
 * <p>지원 언어: 한국어, 영어. 기본 로케일은 영어.</p>
 */
@Configuration
public class LocaleConfig {

    /**
     * Accept-Language 헤더를 파싱하여 로케일을 결정하는 리졸버를 등록한다.
     *
     * @return AcceptHeaderLocaleResolver 빈
     */
    @Bean
    public LocaleResolver localeResolver() {
        final var resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.ENGLISH);
        resolver.setSupportedLocales(Objects.requireNonNull(List.of(Locale.KOREAN, Locale.ENGLISH)));
        return resolver;
    }
}
