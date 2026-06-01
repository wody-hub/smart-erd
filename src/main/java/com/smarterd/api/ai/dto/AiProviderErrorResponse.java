package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.provider.AiProviderError;

public record AiProviderErrorResponse(String type, String title, String detail, boolean retryable) {
    public static AiProviderErrorResponse from(AiProviderError error) {
        if (error == null) {
            return null;
        }
        return new AiProviderErrorResponse(error.type(), error.title(), error.detail(), error.retryable());
    }
}
