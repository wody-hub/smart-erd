package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 다이어그램 사전 세트 변경 응답 DTO.
 *
 * @param dictionarySetId 변경된 사전 세트 ID
 * @param invalidatedTermBindingCount 비활성화된 term 바인딩 수
 * @param invalidatedDomainBindingCount 비활성화된 domain 바인딩 수
 */
@Schema(description = "다이어그램 사전 세트 변경 응답")
public record UpdateDiagramDictionarySetResponse(
    @Schema(description = "사전 세트 ID", example = "1") Long dictionarySetId,
    @Schema(description = "무효화된 term 바인딩 수", example = "0") int invalidatedTermBindingCount,
    @Schema(description = "무효화된 domain 바인딩 수", example = "0") int invalidatedDomainBindingCount
) {}
