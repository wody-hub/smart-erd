package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 다이어그램 사전 세트 변경 요청 DTO.
 *
 * @param dictionarySetId 변경할 사전 세트 ID
 */
@Schema(description = "다이어그램 사전 세트 변경 요청")
public record UpdateDiagramDictionarySetRequest(
    @Schema(description = "사전 세트 ID", example = "1")
    @NotNull(message = "{validation.not-null.dictionary-set-id}")
    Long dictionarySetId
) {}

