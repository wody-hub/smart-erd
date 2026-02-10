package com.smarterd.domain.common.message;

/**
 * 다국어 메시지 코드 enum.
 */
public enum MessageCode {

    ERROR_ACCESS_DENIED_NOT_ADMIN("error.access-denied.not-admin"),
    ERROR_ACCESS_DENIED_NOT_MEMBER("error.access-denied.not-member"),
    ERROR_BUSINESS_CHANGE_OWNER_ROLE("error.business.change-owner-role"),
    ERROR_BUSINESS_DOMAIN_IN_USE("error.business.domain-in-use"),
    ERROR_BUSINESS_DOMAIN_TEAM_MISMATCH("error.business.domain-team-mismatch"),
    ERROR_BUSINESS_PROJECT_TEAM_MISMATCH("error.business.project-team-mismatch"),
    ERROR_BUSINESS_REFRESH_TOKEN_EXPIRED("error.business.refresh-token-expired"),
    ERROR_BUSINESS_REFRESH_TOKEN_INVALID("error.business.refresh-token-invalid"),
    ERROR_BUSINESS_REMOVE_OWNER("error.business.remove-owner"),
    ERROR_BUSINESS_TERM_DOMAIN_TEAM_MISMATCH("error.business.term-domain-team-mismatch"),
    ERROR_BUSINESS_TERM_TEAM_MISMATCH("error.business.term-team-mismatch"),
    ERROR_DUPLICATE_DOMAIN_LOGICAL_NAME("error.duplicate.domain-logical-name"),
    ERROR_DUPLICATE_LOGIN_ID("error.duplicate.login-id"),
    ERROR_DUPLICATE_MEMBER("error.duplicate.member"),
    ERROR_DUPLICATE_TERM_LOGICAL_NAME("error.duplicate.term-logical-name"),
    ERROR_NOT_FOUND_DIAGRAM("error.not-found.diagram"),
    ERROR_NOT_FOUND_DOMAIN("error.not-found.domain"),
    ERROR_NOT_FOUND_PROJECT("error.not-found.project"),
    ERROR_NOT_FOUND_TEAM("error.not-found.team"),
    ERROR_NOT_FOUND_TERM("error.not-found.term"),
    ERROR_NOT_FOUND_USER("error.not-found.user"),
    ERROR_UNEXPECTED("error.unexpected");

    private final String code;

    MessageCode(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    @Override
    public String toString() {
        return code;
    }
}
