package com.smarterd.api.diagram.dto;

import com.smarterd.collaboration.CollaborationLimits;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 다이어그램 저장(콘텐츠 갱신) 요청 DTO.
 *
 * @param content 직렬화된 React Flow JSON (노드 + 엣지). 빈 다이어그램일 때 빈 문자열 허용.
 * @param ydocSnapshot 저장 시점의 현재 Y.Doc 전체 상태 update. REST content와 snapshot 정합성을 맞출 때 사용한다.
 */
@Schema(description = "다이어그램 저장 요청")
public record SaveDiagramRequest(
    @NotNull(message = "{validation.not-null.content}")
    @Schema(description = "직렬화된 React Flow JSON")
    String content,
    @Size(max = CollaborationLimits.MAX_SNAPSHOT_BYTES, message = "{validation.size.ydoc-snapshot}")
    @Schema(description = "현재 Y.Doc 전체 상태 update (base64 인코딩, 선택)")
    byte[] ydocSnapshot
) {}
