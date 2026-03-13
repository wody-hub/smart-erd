package com.smarterd.config.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

class LoginIdAuditorAwareTest {

    private final LoginIdAuditorAware loginIdAuditorAware = new LoginIdAuditorAware();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("getCurrentAuditor - 인증된 사용자가 있으면 loginId를 반환한다")
    void getCurrentAuditor_whenAuthenticated_returnsLoginId() {
        // given
        final var authentication = new TestingAuthenticationToken("tester", "pw");
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // when
        final var auditor = loginIdAuditorAware.getCurrentAuditor();

        // then
        assertThat(auditor).contains("tester");
    }

    @Test
    @DisplayName("getCurrentAuditor - 익명 인증이면 비어 있는 결과를 반환한다")
    void getCurrentAuditor_whenAnonymous_returnsEmpty() {
        // given
        final var authentication = new AnonymousAuthenticationToken(
            "key",
            "anonymousUser",
            AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // when
        final var auditor = loginIdAuditorAware.getCurrentAuditor();

        // then
        assertThat(auditor).isEmpty();
    }

    @Test
    @DisplayName("getCurrentAuditor - 인증 정보가 없으면 비어 있는 결과를 반환한다")
    void getCurrentAuditor_whenAuthenticationMissing_returnsEmpty() {
        // when
        final var auditor = loginIdAuditorAware.getCurrentAuditor();

        // then
        assertThat(auditor).isEmpty();
    }
}
