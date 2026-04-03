package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

/**
 * 다이어그램 생성 요청 DTO.
 *
 * @param name            다이어그램 이름 (필수, 1~100자)
 * @param pluginId        문서 플러그인 ID
 * @param dictionarySetId 적용할 사전 세트 ID
 * @param templateKey     markdown 템플릿 키
 */
@Schema(description = "다이어그램 생성 요청")
public record CreateDiagramRequest(
    @Schema(description = "다이어그램 이름 (1~100자)", example = "Main ERD")
    @NotBlank(message = "{validation.not-blank.diagram-name}")
    @Size(min = 1, max = 100, message = "{validation.size.diagram-name}")
    String name,

    @Schema(description = "문서 플러그인 ID", example = "erd")
    @NotBlank(message = "{validation.not-blank.plugin-id}")
    @Pattern(regexp = "erd|markdown", message = "{validation.pattern.plugin-id}")
    String pluginId,

    @Schema(description = "사전 세트 ID", example = "1") @Nullable Long dictionarySetId,

    @Schema(description = "markdown 템플릿 키", example = "technical-spec")
    @Nullable
    @Pattern(
        regexp = "technical-spec|meeting-notes|release-note",
        message = "{validation.pattern.markdown-template-key}"
    )
    String templateKey
) {}
