package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 다이어그램 저장(콘텐츠 갱신) 요청 DTO.
 *
 * @param content 직렬화된 React Flow JSON (노드 + 엣지)
 */
@Schema(description = "다이어그램 저장 요청")
public record SaveDiagramRequest(@Schema(description = "직렬화된 React Flow JSON") String content) {}
