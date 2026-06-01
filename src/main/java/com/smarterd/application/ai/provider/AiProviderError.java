package com.smarterd.application.ai.provider;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Redacted provider error.
 *
 * @param type stable error type
 * @param title short safe title
 * @param detail redacted safe detail
 * @param retryable whether retry may help
 */
public record AiProviderError(
    @NotBlank @Size(max = 80) String type,
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 500) String detail,
    boolean retryable
) {}
