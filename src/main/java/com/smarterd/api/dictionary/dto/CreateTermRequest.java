package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 용어 생성 요청 DTO.
 *
 * @param logicalName  논리명 (필수, 1~100자)
 * @param physicalName 물리명 (필수, 1~100자)
 * @param domainId     연결 도메인 ID (선택)
 * @param description  설명 (선택, 최대 500자)
 */
@Schema(description = "용어 생성 요청")
public record CreateTermRequest(
    @Schema(description = "논리명 (1~100자)", example = "사용자명")
    @NotBlank(message = "{validation.not-blank.logical-name}")
    @Size(min = 1, max = 100, message = "{validation.size.logical-name}")
    String logicalName,

    @Schema(description = "물리명 (1~100자)", example = "user_name")
    @NotBlank(message = "{validation.not-blank.physical-name}")
    @Size(min = 1, max = 100, message = "{validation.size.physical-name}")
    String physicalName,

    @Schema(description = "연결 도메인 ID (선택)", example = "1") Long domainId,

    @Schema(description = "설명 (최대 500자)", example = "시스템 사용자의 표시 이름")
    @Size(max = 500, message = "{validation.size.description}")
    String description
) {}
