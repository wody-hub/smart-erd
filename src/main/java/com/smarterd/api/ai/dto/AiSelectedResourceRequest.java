package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.AiSelectedResource;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Selected resource request")
public record AiSelectedResourceRequest(
    @Schema(description = "Selected resource type", example = "issue")
    @NotBlank(message = "{validation.not-blank.ai-selected-resource-type}")
    String type,

    @Schema(description = "Selected resource id", example = "10")
    @NotNull(message = "{validation.not-null.ai-selected-resource-id}")
    Long id
) {
    /**
     * 요청 DTO를 selected resource command로 변환한다.
     *
     * @return selected resource command
     */
    public AiSelectedResource toCommand() {
        return new AiSelectedResource(type, id);
    }
}
