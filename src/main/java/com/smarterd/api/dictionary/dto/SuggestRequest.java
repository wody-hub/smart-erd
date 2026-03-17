package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 키워드 추천 요청 DTO.
 *
 * @param keyword 한글 키워드 (2~200자)
 */
@Schema(description = "키워드 추천 요청")
public record SuggestRequest(
    @Schema(description = "한글 키워드", example = "사용자 이름") @NotBlank @Size(min = 2, max = 200) String keyword
) {}
