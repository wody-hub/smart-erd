package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 용어 일괄 저장 요청 DTO.
 *
 * @param rows 저장할 용어 행 목록
 */
@Schema(description = "용어 일괄 저장 요청")
public record BulkTermSaveRequest(
    @Schema(description = "저장할 용어 행 목록") @Valid @NotEmpty List<BulkTermRow> rows
) {}
