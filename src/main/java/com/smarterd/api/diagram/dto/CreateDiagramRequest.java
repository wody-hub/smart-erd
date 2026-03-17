package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 다이어그램 생성 요청 DTO.
 *
 * @param name            다이어그램 이름 (필수, 1~100자)
 * @param dictionarySetId 적용할 사전 세트 ID (필수)
 */
@Schema(description = "다이어그램 생성 요청")
public record CreateDiagramRequest(
    @Schema(description = "다이어그램 이름 (1~100자)", example = "Main ERD")
    @NotBlank(message = "{validation.not-blank.diagram-name}")
    @Size(min = 1, max = 100, message = "{validation.size.diagram-name}")
    String name,

    @Schema(description = "사전 세트 ID", example = "1")
    @NotNull(message = "{validation.not-null.dictionary-set-id}")
    Long dictionarySetId
) {}
