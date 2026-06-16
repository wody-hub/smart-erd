package com.smarterd.application.ai.validation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.provider.AiProviderResult;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.utils.AppStringUtils;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Parses and validates structured provider output.
 */
@Component
public class ProviderOutputValidator {

    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final ActionDraftValidator actionDraftValidator;

    public ProviderOutputValidator(
        ObjectMapper objectMapper,
        Validator validator,
        ActionDraftValidator actionDraftValidator
    ) {
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.actionDraftValidator = actionDraftValidator;
    }

    /**
     * Validate a raw provider JSON string.
     *
     * @param json provider JSON output
     * @return trusted provider result
     */
    public AiProviderResult validate(String json) {
        try {
            return validate(objectMapper.readValue(json, AiProviderResult.class));
        } catch (JsonProcessingException ex) {
            throw outputValidationFailed();
        }
    }

    /**
     * Validate an already materialized provider result.
     *
     * @param result provider result
     * @return trusted provider result
     */
    public AiProviderResult validate(AiProviderResult result) {
        if (result == null) {
            throw outputValidationFailed();
        }
        final Set<ConstraintViolation<AiProviderResult>> violations = validator.validate(result);
        if (!violations.isEmpty()) {
            throw outputValidationFailed();
        }
        if (result.error() == null && AppStringUtils.isBlank(result.answer())) {
            throw outputValidationFailed();
        }
        if (result.error() != null && AppStringUtils.isNotBlank(result.answer())) {
            throw outputValidationFailed();
        }
        final var actions = actionDraftValidator.validate(result.actions());
        return new AiProviderResult(result.answer(), actions, result.error());
    }

    private BusinessException outputValidationFailed() {
        return new BusinessException(MessageCode.ERROR_BUSINESS_AI_OUTPUT_VALIDATION_FAILED.code());
    }
}
