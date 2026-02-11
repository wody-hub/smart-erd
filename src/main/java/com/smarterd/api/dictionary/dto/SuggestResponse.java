package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 키워드 추천 응답 DTO.
 *
 * @param physicalName      추천 물리명
 * @param domainId          추천 도메인 ID (nullable)
 * @param domainLogicalName 추천 도메인 논리명 (nullable)
 * @param matches           매칭 상세 목록
 */
@Schema(description = "키워드 추천 응답")
public record SuggestResponse(
    @Schema(description = "추천 물리명", example = "user_name") String physicalName,
    @Schema(description = "추천 도메인 ID") Long domainId,
    @Schema(description = "추천 도메인 논리명") String domainLogicalName,
    @Schema(description = "매칭 상세") List<SuggestMatch> matches
) {}
