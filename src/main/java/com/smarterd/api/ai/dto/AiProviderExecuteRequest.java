package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiExecutionGateway;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AiProviderExecuteRequest(
    @NotNull Long teamId,
    @NotNull Long projectId,
    @NotBlank @Size(max = 4000) String userMessage,
    @Size(max = 20) String locale,
    @Valid AiSelectedResourceRequest selectedResource
) {
    public AiExecutionGateway.ExecuteCommand toCommand() {
        return new AiExecutionGateway.ExecuteCommand(
            teamId,
            projectId,
            userMessage,
            locale,
            selectedResource == null ? null : selectedResource.toCommand()
        );
    }
}
