package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 도메인 일괄 저장 행 데이터 DTO.
 *
 * @param logicalName  논리명 (필수)
 * @param physicalType 물리 타입 (필수)
 * @param description  설명 (선택)
 */
@Schema(description = "도메인 일괄 저장 행 데이터")
public record BulkDomainRow(
    @Schema(description = "논리명", example = "금액") @NotBlank String logicalName,
    @Schema(description = "물리 타입", example = "DECIMAL(15,2)") @NotBlank String physicalType,
    @Schema(description = "설명", example = "화폐 금액") String description
) {}
