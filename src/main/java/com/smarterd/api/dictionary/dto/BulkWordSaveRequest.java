package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

@Schema(description = "단어 일괄 저장 요청")
public record BulkWordSaveRequest(
    @Schema(description = "검증 세션 토큰")
    @NotBlank(message = "{validation.not-blank.validation-token}")
    String validationToken,
    @Schema(description = "저장에서 제외할 행 번호 목록")
    @NotNull(message = "{validation.not-null.excluded-row-numbers}")
    List<@Positive(message = "{validation.positive.excluded-row-number}") Integer> excludedRowNumbers
) {}
