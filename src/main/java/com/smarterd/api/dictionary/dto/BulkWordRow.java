package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "단어 일괄 저장 행 데이터")
public record BulkWordRow(
    @Schema(description = "논리명", example = "사용자") @NotBlank String logicalName,
    @Schema(description = "물리명", example = "user") @NotBlank String physicalName,
    @Schema(description = "설명") String description
) {}
