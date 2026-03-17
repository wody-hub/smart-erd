package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 사전 세트 수정 요청 DTO.
 *
 * @param name        세트 이름
 * @param description 설명 (선택)
 */
@Schema(description = "사전 세트 수정 요청")
public record UpdateDictionarySetRequest(
    @Schema(description = "세트 이름 (1~100자)", example = "Legacy")
    @NotBlank(message = "{validation.not-blank.dictionary-set-name}")
    @Size(min = 1, max = 100, message = "{validation.size.dictionary-set-name}")
    String name,

    @Schema(description = "설명 (최대 500자)")
    @Size(max = 500, message = "{validation.size.description}")
    String description
) {}
