package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 개별 매칭 정보 DTO.
 *
 * @param keyword      입력 토큰
 * @param matched      매칭 성공 여부
 * @param physicalName 매칭된 물리명 (nullable)
 * @param source       매칭 출처 설명 (nullable)
 */
@Schema(description = "개별 매칭 정보")
public record SuggestMatch(
    @Schema(description = "입력 토큰", example = "사용자") String keyword,
    @Schema(description = "매칭 여부", example = "true") boolean matched,
    @Schema(description = "매칭된 물리명", example = "user") String physicalName,
    @Schema(description = "매칭 출처", example = "용어: 사용자 → user") String source
) {}
