package com.smarterd.application.ai.proposal;

import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Validates proposal creation and approval preconditions.
 */
@Component
public class AiActionProposalValidator {

    public void validateDraft(AiActionDraft draft, Map<String, Object> sanitizedPayload) {
        if (draft == null || !Boolean.TRUE.equals(draft.requiresApproval())) {
            throw validationFailed();
        }
        if (isBlank(draft.type()) || isDestructiveType(draft.type())) {
            throw validationFailed();
        }
        if (isBlank(draft.title()) || isBlank(draft.summary())) {
            throw validationFailed();
        }
        if (isBlank(stringValue(sanitizedPayload.get("targetType")))) {
            throw validationFailed();
        }
    }

    public void validateApproval(AiActionProposal proposal, Instant now) {
        if (!proposal.isPending()) {
            throw validationFailed();
        }
        if (proposal.getExpiresAt() != null && !proposal.getExpiresAt().isAfter(now)) {
            throw validationFailed();
        }
        if (isBlank(proposal.getActionType()) || isDestructiveType(proposal.getActionType())) {
            throw validationFailed();
        }
        if (isBlank(proposal.getTargetType())) {
            throw validationFailed();
        }
    }

    public boolean isDestructiveType(String type) {
        final var normalized = type == null ? "" : type.toLowerCase(Locale.ROOT);
        return normalized.contains("delete") ||
        normalized.contains("remove") ||
        normalized.contains("destroy") ||
        normalized.contains("bulk") ||
        normalized.contains("drop") ||
        normalized.contains("truncate") ||
        normalized.contains("shell") ||
        normalized.contains("command") ||
        normalized.contains("execute") ||
        normalized.contains("sql");
    }

    static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private BusinessException validationFailed() {
        return new BusinessException(MessageCode.ERROR_BUSINESS_AI_OUTPUT_VALIDATION_FAILED.code());
    }
}
