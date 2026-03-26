package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.lang.Nullable;

/**
 * 다이어그램 collaboration bootstrap 응답 DTO.
 *
 * <p>plugin/engine 선택과 snapshot hydrate 가능 여부만 전달하며,
 * 실제 snapshot payload는 handoff/별도 채널에서 로드한다.</p>
 *
 * @param pluginId 문서 플러그인 ID
 * @param engineId shared document engine ID
 * @param pluginSchemaVersion 플러그인 스키마 버전
 * @param snapshotFormatVersion snapshot 포맷 버전
 * @param artifactVersion content fallback artifact 버전 (없으면 null)
 * @param revision 현재 bootstrap 기준 revision
 * @param snapshotAvailable snapshot 존재 여부
 * @param artifactAvailable content fallback artifact 존재 여부
 */
@Schema(description = "다이어그램 collaboration bootstrap 응답")
public record DiagramBootstrapResponse(
    @Schema(description = "문서 플러그인 ID", example = "erd") String pluginId,
    @Schema(description = "shared document engine ID", example = "yjs") String engineId,
    @Schema(description = "플러그인 스키마 버전", example = "1") int pluginSchemaVersion,
    @Schema(description = "snapshot 포맷 버전", example = "1") int snapshotFormatVersion,
    @Nullable @Schema(description = "content fallback artifact 버전", example = "1") Integer artifactVersion,
    @Schema(description = "bootstrap 기준 revision", example = "42") String revision,
    @Schema(description = "snapshot 존재 여부") boolean snapshotAvailable,
    @Schema(description = "content fallback artifact 존재 여부") boolean artifactAvailable
) {}
