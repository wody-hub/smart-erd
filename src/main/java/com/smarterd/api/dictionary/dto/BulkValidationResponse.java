package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 일괄 업로드 검증 응답 DTO.
 *
 * @param validationToken 검증 세션 토큰 (저장 요청 시 사용)
 * @param totalCount 전체 행 수
 * @param validCount 유효 행 수
 * @param errorCount 에러 행 수
 * @param previewTruncated 미리보기가 일부만 반환되었는지 여부
 * @param rows       미리보기 행별 검증 결과
 */
@Schema(description = "일괄 업로드 검증 응답")
public record BulkValidationResponse(
    @Schema(description = "검증 세션 토큰", example = "6cde9ae4-1f7f-4bf8-8d10-76a60bfec17d") String validationToken,
    @Schema(description = "전체 행 수", example = "15") int totalCount,
    @Schema(description = "유효 행 수", example = "12") int validCount,
    @Schema(description = "에러 행 수", example = "3") int errorCount,
    @Schema(description = "미리보기가 일부만 반환되었는지 여부", example = "false") boolean previewTruncated,
    @Schema(description = "미리보기 행별 검증 결과") List<BulkValidationRow> rows
) {}
