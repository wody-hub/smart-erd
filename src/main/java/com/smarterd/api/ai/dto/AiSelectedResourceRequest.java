package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiSelectedResource;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AiSelectedResourceRequest(@NotBlank String type, @NotNull Long id) {
    public AiSelectedResource toCommand() {
        return new AiSelectedResource(type, id);
    }
}
