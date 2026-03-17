package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 다이어그램 저장(콘텐츠 갱신) 요청 DTO.
 *
 * @param content 직렬화된 React Flow JSON (노드 + 엣지). 빈 다이어그램일 때 빈 문자열 허용.
 */
@Schema(description = "다이어그램 저장 요청")
public record SaveDiagramRequest(
    @NotNull(message = "{validation.not-null.content}") @Schema(description = "직렬화된 React Flow JSON") String content
) {}
