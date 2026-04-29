package com.smarterd.domain.common.message;

/**
 * 다국어 메시지 코드 enum.
 */
public enum MessageCode {
    ERROR_AUTH_BAD_CREDENTIALS("error.auth.bad-credentials"),
    ERROR_AUTH_LOGIN_RATE_LIMITED("error.auth.login-rate-limited"),
    ERROR_ACCESS_DENIED_NOT_ADMIN("error.access-denied.not-admin"),
    ERROR_ACCESS_DENIED_NOT_MEMBER("error.access-denied.not-member"),
    ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY("error.access-denied.project-todo-owner-only"),
    ERROR_ACCESS_DENIED_VIEWER_READONLY("error.access-denied.viewer-readonly"),
    ERROR_ACCESS_DENIED_DIAGRAM_CHANNEL_TYPE("error.access-denied.diagram-channel-type"),
    ERROR_ACCESS_DENIED_DIAGRAM_RESOURCE_ID("error.access-denied.diagram-resource-id"),
    ERROR_BULK_CONCURRENT_DUPLICATE("error.bulk.concurrent-duplicate"),
    ERROR_BULK_EMPTY_FILE("error.bulk.empty-file"),
    ERROR_BULK_MISSING_COLUMNS("error.bulk.missing-columns"),
    ERROR_BULK_TOO_MANY_ROWS("error.bulk.too-many-rows"),
    ERROR_BULK_UNSUPPORTED_FORMAT("error.bulk.unsupported-format"),
    ERROR_BULK_VALIDATION_TOKEN_ISSUE_FAILED("error.bulk.validation-token-issue-failed"),
    ERROR_BULK_VALIDATION_TOKEN_INVALID("error.bulk.validation-token-invalid"),
    ERROR_BULK_VALIDATION_DATA_LENGTH_INVALID("error.bulk.validation.data-length-invalid"),
    ERROR_BULK_VALIDATION_DATA_LENGTH_REQUIRED_FOR_TYPE("error.bulk.validation.data-length-required-for-type"),
    ERROR_BULK_VALIDATION_DATA_SCALE_INVALID("error.bulk.validation.data-scale-invalid"),
    ERROR_BULK_VALIDATION_DATA_SCALE_REQUIRES_LENGTH("error.bulk.validation.data-scale-requires-length"),
    ERROR_BULK_VALIDATION_DATA_TYPE_MAX_LENGTH("error.bulk.validation.data-type-max-length"),
    ERROR_BULK_VALIDATION_DATA_TYPE_REQUIRED("error.bulk.validation.data-type-required"),
    ERROR_BULK_VALIDATION_DESCRIPTION_MAX_LENGTH("error.bulk.validation.description-max-length"),
    ERROR_BULK_VALIDATION_DOMAIN_CLASSIFICATION_MAX_LENGTH("error.bulk.validation.domain-classification-max-length"),
    ERROR_BULK_VALIDATION_DOMAIN_GROUP_MAX_LENGTH("error.bulk.validation.domain-group-max-length"),
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
    ERROR_BUSINESS_DOMAIN_DATA_LENGTH_REQUIRED("error.business.domain.data-length-required"),
    ERROR_BUSINESS_DOMAIN_DATA_SCALE_INVALID("error.business.domain.data-scale-invalid"),
    ERROR_BUSINESS_DOMAIN_DATA_SCALE_REQUIRES_LENGTH("error.business.domain.data-scale-requires-length"),
    ERROR_BUSINESS_DOMAIN_TEAM_MISMATCH("error.business.domain-team-mismatch"),
    ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH("error.business.dictionary-set-team-mismatch"),
    ERROR_BUSINESS_DIAGRAM_DICTIONARY_SET_IN_USE("error.business.diagram-dictionary-set-in-use"),
    ERROR_BUSINESS_DIAGRAM_DICTIONARY_SET_CHANGE_WHILE_EDITING(
        "error.business.diagram-dictionary-set-change-while-editing"
    ),
    ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON("error.business.diagram-content-invalid-json"),
    ERROR_BUSINESS_DIAGRAM_SNAPSHOT_STALE("error.business.diagram-snapshot-stale"),
    ERROR_BUSINESS_DIAGRAM_SAVE_WHILE_EDITING("error.business.diagram-save-while-editing"),
    ERROR_BUSINESS_DOCUMENT_PLUGIN_UNSUPPORTED("error.business.document-plugin-unsupported"),
    ERROR_BUSINESS_DOCUMENT_EXPORT_FORMAT_UNSUPPORTED("error.business.document-export-format-unsupported"),
    ERROR_BUSINESS_ERD_DICTIONARY_CONTEXT_REQUIRED("error.business.erd-dictionary-context-required"),
    ERROR_BUSINESS_INVALID_PROJECT_PERIOD("error.business.invalid-project-period"),
    ERROR_BUSINESS_PROJECT_ISSUE_TITLE_REQUIRED("error.business.project-issue-title-required"),
    ERROR_BUSINESS_PROJECT_ISSUE_TITLE_TOO_LONG("error.business.project-issue-title-too-long"),
    ERROR_BUSINESS_PROJECT_ISSUE_DESCRIPTION_TOO_LONG("error.business.project-issue-description-too-long"),
    ERROR_BUSINESS_PROJECT_ISSUE_STATUS_TRANSITION_INVALID("error.business.project-issue-status-transition-invalid"),
    ERROR_BUSINESS_PROJECT_TODO_TITLE_REQUIRED("error.business.project-todo-title-required"),
    ERROR_BUSINESS_PROJECT_TODO_TITLE_TOO_LONG("error.business.project-todo-title-too-long"),
    ERROR_BUSINESS_PROJECT_TODO_DESCRIPTION_TOO_LONG("error.business.project-todo-description-too-long"),
    ERROR_BUSINESS_PROJECT_TODO_PROGRESS_RATE_OUT_OF_RANGE("error.business.project-todo-progress-rate-out-of-range"),
    ERROR_BUSINESS_WORK_COMMENT_CONTENT_REQUIRED("error.business.work-comment-content-required"),
    ERROR_BUSINESS_WORK_COMMENT_CONTENT_TOO_LONG("error.business.work-comment-content-too-long"),
    ERROR_BUSINESS_INVALID_STAFFING_PERIOD("error.business.invalid-staffing-period"),
    ERROR_BUSINESS_INVALID_STAFFING_ACTUAL_PERIOD("error.business.invalid-staffing-actual-period"),
    ERROR_BUSINESS_INVALID_WBS_PERIOD("error.business.invalid-wbs-period"),
    ERROR_BUSINESS_MARKDOWN_DICTIONARY_CONTEXT_NOT_ALLOWED("error.business.markdown-dictionary-context-not-allowed"),
    ERROR_BUSINESS_SCREEN_SPEC_DICTIONARY_CONTEXT_NOT_ALLOWED(
        "error.business.screen-spec-dictionary-context-not-allowed"
    ),
    ERROR_BUSINESS_MARKDOWN_TEMPLATE_INVALID("error.business.markdown-template-invalid"),
    ERROR_BUSINESS_DICTIONARY_SET_DEFAULT_DELETE_FORBIDDEN("error.business.dictionary-set-default-delete-forbidden"),
    ERROR_BUSINESS_PROJECT_TEAM_MISMATCH("error.business.project-team-mismatch"),
    ERROR_BUSINESS_REFRESH_TOKEN_EXPIRED("error.business.refresh-token-expired"),
    ERROR_BUSINESS_REFRESH_TOKEN_INVALID("error.business.refresh-token-invalid"),
    ERROR_BUSINESS_REFRESH_TOKEN_REUSED("error.business.refresh-token-reused"),
    ERROR_BUSINESS_REMOVE_OWNER("error.business.remove-owner"),
    ERROR_BUSINESS_TERM_DOMAIN_SET_MISMATCH("error.business.term-domain-set-mismatch"),
    ERROR_BUSINESS_TERM_DOMAIN_TEAM_MISMATCH("error.business.term-domain-team-mismatch"),
    ERROR_BUSINESS_TERM_TEAM_MISMATCH("error.business.term-team-mismatch"),
    ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED("error.business.wbs-depth-limit-exceeded"),
    ERROR_BUSINESS_STAFFING_COST_OUT_OF_RANGE("error.business.staffing-cost-out-of-range"),
    ERROR_BUSINESS_STAFFING_MONTHLY_RATE_OUT_OF_RANGE("error.business.staffing-monthly-rate-out-of-range"),
    ERROR_BUSINESS_STAFFING_PARTICIPATION_OUT_OF_RANGE("error.business.staffing-participation-out-of-range"),
    ERROR_BUSINESS_WBS_ESTIMATED_MM_OUT_OF_RANGE("error.business.wbs-estimated-mm-out-of-range"),
    ERROR_BUSINESS_WBS_DEPENDENCY_CYCLE("error.business.wbs-dependency-cycle"),
    ERROR_BUSINESS_WBS_DEPENDENCY_SELF_REFERENCE("error.business.wbs-dependency-self-reference"),
    ERROR_BUSINESS_WBS_PROGRESS_RATE_OUT_OF_RANGE("error.business.wbs-progress-rate-out-of-range"),
    ERROR_BUSINESS_WBS_REORDER_INVALID("error.business.wbs-reorder-invalid"),
    ERROR_BUSINESS_WORD_TEAM_MISMATCH("error.business.word-team-mismatch"),
    ERROR_BUSINESS_TICKET_LIMIT_EXCEEDED("error.business.ticket-limit-exceeded"),
    ERROR_DUPLICATE_DICTIONARY_SET_NAME("error.duplicate.dictionary-set-name"),
    ERROR_DUPLICATE_DOMAIN_LOGICAL_NAME("error.duplicate.domain-logical-name"),
    ERROR_DUPLICATE_LOGIN_ID("error.duplicate.login-id"),
    ERROR_DUPLICATE_MEMBER("error.duplicate.member"),
    ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER("error.duplicate.project-staffing-member"),
    ERROR_DUPLICATE_TERM_LOGICAL_NAME("error.duplicate.term-logical-name"),
    ERROR_DUPLICATE_WBS_DEPENDENCY("error.duplicate.wbs-dependency"),
    ERROR_DUPLICATE_WORD_LOGICAL_NAME("error.duplicate.word-logical-name"),
    ERROR_NOT_FOUND_DIAGRAM("error.not-found.diagram"),
    ERROR_NOT_FOUND_DICTIONARY_SET("error.not-found.dictionary-set"),
    ERROR_NOT_FOUND_DOMAIN("error.not-found.domain"),
    ERROR_NOT_FOUND_MILESTONE("error.not-found.milestone"),
    ERROR_NOT_FOUND_PROJECT("error.not-found.project"),
    ERROR_NOT_FOUND_PROJECT_ISSUE("error.not-found.project-issue"),
    ERROR_NOT_FOUND_PROJECT_TODO("error.not-found.project-todo"),
    ERROR_NOT_FOUND_PROJECT_STAFFING("error.not-found.project-staffing"),
    ERROR_NOT_FOUND_TEAM("error.not-found.team"),
    ERROR_NOT_FOUND_TERM("error.not-found.term"),
    ERROR_NOT_FOUND_WBS_DEPENDENCY("error.not-found.wbs-dependency"),
    ERROR_NOT_FOUND_WBS_ITEM("error.not-found.wbs-item"),
    ERROR_NOT_FOUND_WORD("error.not-found.word"),
    ERROR_NOT_FOUND_USER("error.not-found.user"),
    ERROR_VALIDATION_FAILED("error.validation.failed"),
    ERROR_UNEXPECTED("error.unexpected");

    private final String code;

    MessageCode(String code) {
        this.code = code;
    }

    /**
     * 메시지 코드 문자열을 반환한다.
     *
     * @return i18n lookup용 코드 문자열
     */
    public String code() {
        return code;
    }

    /**
     * 메시지 코드를 문자열로 반환한다.
     *
     * @return 메시지 코드 문자열
     */
    @Override
    public String toString() {
        return code;
    }
}
