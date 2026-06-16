package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 다이어그램 정의서 엑셀 다운로드 요청.
 *
 * @param content 현재 캔버스 기준 직렬화된 다이어그램 JSON (nullable)
 */
@Schema(description = "다이어그램 정의서 엑셀 다운로드 요청")
public record ExportDiagramWorkbookRequest(
    @Schema(description = "현재 캔버스 기준 직렬화된 다이어그램 JSON", nullable = true) String content
) {}
