package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiExecutionGateway;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "AI provider execution request")
public record AiProviderExecuteRequest(
    @Schema(description = "Team id", example = "1")
    @NotNull(message = "{validation.not-null.ai-provider-team-id}")
    Long teamId,

    @Schema(description = "Project id", example = "10")
    @NotNull(message = "{validation.not-null.ai-provider-project-id}")
    Long projectId,

    @Schema(description = "User message", example = "status?")
    @NotBlank(message = "{validation.not-blank.ai-provider-user-message}")
    @Size(max = 4000, message = "{validation.size.ai-provider-user-message}")
    String userMessage,

    @Schema(description = "Preferred locale", example = "ko")
    @Size(max = 20, message = "{validation.size.ai-locale}")
    String locale,

    @Schema(description = "Selected resource context") @Valid AiSelectedResourceRequest selectedResource
) {
    /**
     * 요청 DTO를 provider 실행 command로 변환한다.
     *
     * @return provider 실행 command
     */
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
