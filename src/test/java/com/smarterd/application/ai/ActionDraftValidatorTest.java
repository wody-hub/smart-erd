package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.application.ai.provider.AiActionDraft;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.application.ai.validation.ActionDraftValidator;
import com.smarterd.domain.common.exception.BusinessException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ActionDraftValidatorTest {

    private final ActionDraftValidator validator = new ActionDraftValidator();

    @Test
    void validate_acceptsUnknownNonDestructiveDraftWithApproval() {
        final var drafts = List.of(
            new AiActionDraft("a1", "issue.create", "Create issue", "Draft only", AiActionRiskLevel.LOW, true, Map.of())
        );

        final var result = validator.validate(drafts);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().type()).isEqualTo("issue.create");
    }

    @Test
    void validate_rejectsDeleteOrBulkDestructiveDrafts() {
        final var drafts = List.of(
            new AiActionDraft("a1", "issue.delete", "Delete issue", "Unsafe", AiActionRiskLevel.LOW, true, Map.of())
        );

        assertThatThrownBy(() -> validator.validate(drafts)).isInstanceOf(BusinessException.class);
    }

    @Test
    void validate_rejectsDraftWithoutExplicitApprovalFlag() {
        final var drafts = List.of(
            new AiActionDraft("a1", "todo.update", "Update TODO", "Missing approval", AiActionRiskLevel.LOW, false, Map.of())
        );

        assertThatThrownBy(() -> validator.validate(drafts)).isInstanceOf(BusinessException.class);
    }
}
