package com.smarterd.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.validation.ActionDraftValidator;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import com.smarterd.domain.common.exception.BusinessException;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class ProviderOutputValidatorTest {

    private final ProviderOutputValidator validator = new ProviderOutputValidator(
        new ObjectMapper(),
        Validation.buildDefaultValidatorFactory().getValidator(),
        new ActionDraftValidator()
    );

    @Test
    void validate_acceptsAnswerOnlyJson() {
        final var result = validator.validate(
            """
            {
              "answer": "Local Codex is not configured yet.",
              "actions": []
            }
            """
        );

        assertThat(result.answer()).isEqualTo("Local Codex is not configured yet.");
        assertThat(result.actions()).isEmpty();
        assertThat(result.error()).isNull();
    }

    @Test
    void validate_acceptsProviderErrorJson() {
        final var result = validator.validate(
            """
            {
              "actions": [],
              "error": {
                "type": "NOT_CONFIGURED",
                "title": "Not configured",
                "detail": "No provider is configured.",
                "retryable": false
              }
            }
            """
        );

        assertThat(result.error()).isNotNull();
        assertThat(result.error().type()).isEqualTo("NOT_CONFIGURED");
    }

    @Test
    void validate_rejectsInvalidJsonWithoutRawTextFallback() {
        assertThatThrownBy(() -> validator.validate("plain text")).isInstanceOf(BusinessException.class);
    }

    @Test
    void validate_rejectsUnsafeActionDraft() {
        assertThatThrownBy(() ->
            validator.validate(
                """
                {
                  "answer": "I can delete it.",
                  "actions": [
                    {
                      "id": "a1",
                      "type": "todo.bulk-delete",
                      "title": "Delete all",
                      "summary": "Unsafe",
                      "riskLevel": "LOW",
                      "requiresApproval": true,
                      "payload": {}
                    }
                  ]
                }
                """
            )
        ).isInstanceOf(BusinessException.class);
    }

    @Test
    void validate_acceptsActionDraftPayloadWithNullValues() {
        final var result = validator.validate(
            """
            {
              "answer": "승인하면 TODO를 생성하겠습니다.",
              "actions": [
                {
                  "id": "a1",
                  "type": "todo.create",
                  "title": "QA 확인 TODO 생성",
                  "summary": "프로젝트에 QA 확인 TODO를 추가합니다.",
                  "riskLevel": "LOW",
                  "requiresApproval": true,
                  "payload": {
                    "targetType": "todo",
                    "targetId": null,
                    "targetLabel": "QA 확인",
                    "fields": [
                      {
                        "name": "title",
                        "beforeValue": null,
                        "afterValue": "QA 확인"
                      }
                    ]
                  }
                }
              ],
              "error": null
            }
            """
        );

        assertThat(result.actions()).hasSize(1);
        assertThat(result.actions().getFirst().payload()).containsEntry("targetId", null);
    }
}
