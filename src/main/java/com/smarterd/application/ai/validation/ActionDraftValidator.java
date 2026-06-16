package com.smarterd.application.ai.validation;

import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.utils.AppStringUtils;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Validates Phase 9 action draft safety constraints.
 */
@Component
public class ActionDraftValidator {

    /**
     * Validate action drafts and return an immutable safe list.
     *
     * @param actions provider action drafts
     * @return validated actions
     */
    public List<AiActionDraft> validate(List<AiActionDraft> actions) {
        if (actions == null || actions.isEmpty()) {
            return List.of();
        }
        actions.forEach(this::validateOne);
        return List.copyOf(actions);
    }

    private void validateOne(AiActionDraft action) {
        if (!Boolean.TRUE.equals(action.requiresApproval())) {
            throw outputValidationFailed();
        }
        final var type = AppStringUtils.lowerCaseToEmpty(action.type());
        if (
            type.contains("delete") ||
            type.contains("remove") ||
            type.contains("destroy") ||
            type.contains("bulk") ||
            type.contains("drop") ||
            type.contains("truncate") ||
            type.contains("shell") ||
            type.contains("command") ||
            type.contains("execute") ||
            type.contains("sql")
        ) {
            throw outputValidationFailed();
        }
    }

    private BusinessException outputValidationFailed() {
        return new BusinessException(MessageCode.ERROR_BUSINESS_AI_OUTPUT_VALIDATION_FAILED.code());
    }
}
