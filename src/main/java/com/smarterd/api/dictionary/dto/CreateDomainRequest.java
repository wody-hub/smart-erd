package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 도메인 생성 요청 DTO.
 *
 * @param logicalName  논리명 (필수, 1~100자)
 * @param physicalType 물리 데이터 타입 (필수, 1~50자)
 * @param description  설명 (선택, 최대 500자)
 */
@Schema(description = "도메인 생성 요청")
public record CreateDomainRequest(
    @Schema(description = "논리명 (1~100자)", example = "금액")
    @NotBlank(message = "{validation.not-blank.logical-name}")
    @Size(min = 1, max = 100, message = "{validation.size.logical-name}")
    String logicalName,

    @Schema(description = "물리 데이터 타입 (1~50자)", example = "DECIMAL(15,2)")
    @NotBlank(message = "{validation.not-blank.physical-type}")
    @Size(min = 1, max = 50, message = "{validation.size.physical-type}")
    String physicalType,

    @Schema(description = "설명 (최대 500자)", example = "화폐 금액을 나타내는 타입")
    @Size(max = 500, message = "{validation.size.description}")
    String description
) {}
