package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiExecutionGateway;
import java.time.Instant;

public record AiProviderStatusResponse(String provider, String availability, String message, Instant checkedAt) {
    public static AiProviderStatusResponse from(AiExecutionGateway.AiProviderStatusView status) {
        return new AiProviderStatusResponse(status.provider(), status.availability(), status.message(), status.checkedAt());
    }
}
