package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 일괄 저장 응답 DTO.
 *
 * @param savedCount  저장 성공 건수
 * @param failedCount 저장 실패 건수
 */
@Schema(description = "일괄 저장 응답")
public record BulkSaveResponse(
    @Schema(description = "저장 성공 건수", example = "12") int savedCount,
    @Schema(description = "저장 실패 건수", example = "0") int failedCount
) {}
