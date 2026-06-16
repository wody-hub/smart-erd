package com.smarterd.application.ai.chat;

import com.smarterd.domain.common.message.MessageCode;

public enum AiChatConfirmationReason {
    WEAK_SCOPE(MessageCode.ERROR_BUSINESS_AI_CHAT_SCOPE_REQUIRED),
    AMBIGUOUS_PROJECT(MessageCode.ERROR_BUSINESS_AI_CHAT_PROJECT_AMBIGUOUS),
    FUZZY_PROJECT(MessageCode.ERROR_BUSINESS_AI_CHAT_PROJECT_FUZZY_CONFIRMATION),
    CONFLICTING_PROJECT(MessageCode.ERROR_BUSINESS_AI_CHAT_PROJECT_CONFLICTING),
    TOO_MANY_PROJECTS(MessageCode.ERROR_BUSINESS_AI_CHAT_TOO_MANY_PROJECTS),
    UNSUPPORTED_ALL_TEAM(MessageCode.ERROR_BUSINESS_AI_CHAT_ALL_TEAM_UNSUPPORTED),
    UNAUTHORIZED_SCOPE(MessageCode.ERROR_ACCESS_DENIED_AI_CHAT_SCOPE);

    private final MessageCode messageCode;

    AiChatConfirmationReason(MessageCode messageCode) {
        this.messageCode = messageCode;
    }

    /**
     * Returns the localized message code for this confirmation reason.
     *
     * @return message code string
     */
    public String messageCode() {
        return messageCode.code();
    }
}
