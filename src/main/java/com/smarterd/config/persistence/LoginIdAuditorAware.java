package com.smarterd.config.persistence;

import com.smarterd.utils.AppStringUtils;
import java.util.Optional;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Spring Data JPA Auditing용 현재 감사자(loginId) 조회기.
 *
 * <p>JWT Resource Server 인증에서 {@link Authentication#getName()}은 JWT subject(loginId)를 반환하므로,
 * 별도 claim 파싱 없이 현재 사용자 loginId를 감사 컬럼에 기록한다.</p>
 */
@Component("loginIdAuditorAware")
public class LoginIdAuditorAware implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        final var context = SecurityContextHolder.getContext();
        if (context == null) {
            return Optional.empty();
        }

        final var authentication = context.getAuthentication();
        if (!isAuditableAuthentication(authentication)) {
            return Optional.empty();
        }

        return Optional.ofNullable(AppStringUtils.trimToNull(authentication.getName()));
    }

    private boolean isAuditableAuthentication(Authentication authentication) {
        return authentication != null &&
        authentication.isAuthenticated() &&
        !(authentication instanceof AnonymousAuthenticationToken);
    }
}
