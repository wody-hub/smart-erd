package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 도메인 일괄 저장 행 데이터 DTO.
 *
 * @param domainGroup 도메인 그룹
 * @param domainClassification 도메인명
 * @param logicalName  공통 표준 도메인명 (필수)
 * @param dataType 데이터 타입 (필수)
 * @param dataLength 데이터 길이
 * @param dataScale 데이터 소수점 길이
 * @param description  설명 (선택)
 */
@Schema(description = "도메인 일괄 저장 행 데이터")
public record BulkDomainRow(
    @Schema(description = "도메인 그룹", example = "명칭") String domainGroup,
    @Schema(description = "도메인명", example = "명") String domainClassification,
    @Schema(description = "공통 표준 도메인명", example = "금액_DECIMAL15_2")
    @NotBlank(message = "{validation.not-blank.logical-name}")
    String logicalName,
    @Schema(description = "데이터 타입", example = "DECIMAL")
    @NotBlank(message = "{validation.not-blank.data-type}")
    String dataType,
    @Schema(description = "데이터 길이", example = "15") Integer dataLength,
    @Schema(description = "데이터 소수점 길이", example = "2") Integer dataScale,
    @Schema(description = "설명", example = "화폐 금액") String description
) {}
