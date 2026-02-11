package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 일괄 업로드 검증 응답 DTO.
 *
 * @param totalCount 전체 행 수
 * @param validCount 유효 행 수
 * @param errorCount 에러 행 수
 * @param rows       행별 검증 결과
 */
@Schema(description = "일괄 업로드 검증 응답")
public record BulkValidationResponse(
    @Schema(description = "전체 행 수", example = "15") int totalCount,
    @Schema(description = "유효 행 수", example = "12") int validCount,
    @Schema(description = "에러 행 수", example = "3") int errorCount,
    @Schema(description = "행별 검증 결과") List<BulkValidationRow> rows
) {}
