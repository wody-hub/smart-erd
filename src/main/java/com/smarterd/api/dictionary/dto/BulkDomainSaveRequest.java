package com.smarterd.api.dictionary.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 도메인 일괄 저장 요청 DTO.
 *
 * @param rows 저장할 도메인 행 목록
 */
@Schema(description = "도메인 일괄 저장 요청")
public record BulkDomainSaveRequest(
    @Schema(description = "저장할 도메인 행 목록") @Valid @NotEmpty List<BulkDomainRow> rows
) {}
