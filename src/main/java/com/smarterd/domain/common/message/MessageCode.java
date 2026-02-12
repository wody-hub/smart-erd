package com.smarterd.domain.common.message;

/**
 * 다국어 메시지 코드 enum.
 */
public enum MessageCode {
    ERROR_ACCESS_DENIED_NOT_ADMIN("error.access-denied.not-admin"),
    ERROR_ACCESS_DENIED_NOT_MEMBER("error.access-denied.not-member"),
    ERROR_ACCESS_DENIED_VIEWER_READONLY("error.access-denied.viewer-readonly"),
    ERROR_BULK_CONCURRENT_DUPLICATE("error.bulk.concurrent-duplicate"),
    ERROR_BULK_EMPTY_FILE("error.bulk.empty-file"),
    ERROR_BULK_MISSING_COLUMNS("error.bulk.missing-columns"),
    ERROR_BULK_TOO_MANY_ROWS("error.bulk.too-many-rows"),
    ERROR_BULK_UNSUPPORTED_FORMAT("error.bulk.unsupported-format"),
    ERROR_BULK_VALIDATION_DESCRIPTION_MAX_LENGTH("error.bulk.validation.description-max-length"),
    ERROR_BULK_VALIDATION_DOMAIN_NOT_FOUND("error.bulk.validation.domain-not-found"),
    ERROR_BULK_VALIDATION_DUPLICATE_IN_DB("error.bulk.validation.duplicate-in-db"),
    ERROR_BULK_VALIDATION_DUPLICATE_IN_FILE("error.bulk.validation.duplicate-in-file"),
    ERROR_BULK_VALIDATION_LOGICAL_NAME_MAX_LENGTH("error.bulk.validation.logical-name-max-length"),
    ERROR_BULK_VALIDATION_LOGICAL_NAME_REQUIRED("error.bulk.validation.logical-name-required"),
    ERROR_BULK_VALIDATION_PHYSICAL_NAME_MAX_LENGTH("error.bulk.validation.physical-name-max-length"),
    ERROR_BULK_VALIDATION_PHYSICAL_NAME_REQUIRED("error.bulk.validation.physical-name-required"),
    ERROR_BULK_VALIDATION_PHYSICAL_TYPE_MAX_LENGTH("error.bulk.validation.physical-type-max-length"),
    ERROR_BULK_VALIDATION_PHYSICAL_TYPE_REQUIRED("error.bulk.validation.physical-type-required"),
    ERROR_BUSINESS_CHANGE_OWNER_ROLE("error.business.change-owner-role"),
    ERROR_BUSINESS_DOMAIN_IN_USE("error.business.domain-in-use"),
    ERROR_BUSINESS_DOMAIN_TEAM_MISMATCH("error.business.domain-team-mismatch"),
    ERROR_BUSINESS_PROJECT_TEAM_MISMATCH("error.business.project-team-mismatch"),
    ERROR_BUSINESS_REFRESH_TOKEN_EXPIRED("error.business.refresh-token-expired"),
    ERROR_BUSINESS_REFRESH_TOKEN_INVALID("error.business.refresh-token-invalid"),
    ERROR_BUSINESS_REMOVE_OWNER("error.business.remove-owner"),
    ERROR_BUSINESS_TERM_DOMAIN_TEAM_MISMATCH("error.business.term-domain-team-mismatch"),
    ERROR_BUSINESS_TERM_TEAM_MISMATCH("error.business.term-team-mismatch"),
    ERROR_BUSINESS_TICKET_LIMIT_EXCEEDED("error.business.ticket-limit-exceeded"),
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
