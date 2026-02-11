package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 용어 일괄 저장 행 데이터 DTO.
 *
 * @param logicalName       논리명 (필수)
 * @param physicalName      물리명 (필수)
 * @param domainLogicalName 도메인 논리명 (선택 — 논리명으로 도메인 참조)
 * @param description       설명 (선택)
 */
@Schema(description = "용어 일괄 저장 행 데이터")
public record BulkTermRow(
    @Schema(description = "논리명", example = "사용자명") @NotBlank String logicalName,
    @Schema(description = "물리명", example = "user_name") @NotBlank String physicalName,
    @Schema(description = "도메인 논리명", example = "이름") String domainLogicalName,
    @Schema(description = "설명") String description
) {}
