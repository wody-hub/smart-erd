package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 단어 수정 요청 DTO.
 *
 * @param logicalName  논리명
 * @param physicalName 물리명
 * @param description  설명
 */
@Schema(description = "단어 수정 요청")
public record UpdateWordRequest(
    @Schema(description = "논리명 (1~100자)", example = "사용자")
    @NotBlank(message = "{validation.not-blank.logical-name}")
    @Size(min = 1, max = 100, message = "{validation.size.logical-name}")
    String logicalName,

    @Schema(description = "물리명 (1~100자)", example = "user")
    @NotBlank(message = "{validation.not-blank.physical-name}")
    @Size(min = 1, max = 100, message = "{validation.size.physical-name}")
    String physicalName,

    @Schema(description = "설명 (최대 500자)", example = "시스템 사용자")
    @Size(max = 500, message = "{validation.size.description}")
    String description
) {}
