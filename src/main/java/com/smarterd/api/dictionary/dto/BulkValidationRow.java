package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

/**
 * 개별 행 검증 결과 DTO.
 *
 * @param rowNumber 엑셀 원본 행 번호
 * @param valid     유효 여부
 * @param errors    에러 메시지 목록
 * @param data      파싱된 데이터 (key-value)
 */
@Schema(description = "개별 행 검증 결과")
public record BulkValidationRow(
    @Schema(description = "행 번호", example = "2") int rowNumber,
    @Schema(description = "유효 여부", example = "true") boolean valid,
    @Schema(description = "에러 메시지 목록") List<String> errors,
    @Schema(description = "파싱된 데이터") Map<String, String> data
) {}
