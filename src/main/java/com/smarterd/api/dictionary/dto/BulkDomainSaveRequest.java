package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

/**
 * 도메인 일괄 저장 요청 DTO.
 *
 * @param validationToken   검증 세션 토큰
 * @param excludedRowNumbers 저장에서 제외할 행 번호 목록
 */
@Schema(description = "도메인 일괄 저장 요청")
public record BulkDomainSaveRequest(
    @Schema(description = "검증 세션 토큰") @NotBlank String validationToken,
    @Schema(description = "저장에서 제외할 행 번호 목록") @NotNull List<@Positive Integer> excludedRowNumbers
) {}
