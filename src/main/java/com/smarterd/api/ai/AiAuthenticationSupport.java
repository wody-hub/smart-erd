package com.smarterd.api.ai;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Shared authentication helpers for AI REST controllers.
 */
final class AiAuthenticationSupport {

    private AiAuthenticationSupport() {}

    /**
     * Extracts the authenticated subject or raises the shared AI access error.
     *
     * @param jwt authenticated principal
     * @return authenticated subject
     */
    static String subject(Jwt jwt) {
        if (jwt == null) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code());
        }
        return jwt.getSubject();
    }
}
