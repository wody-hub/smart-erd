package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Y.Doc 스냅샷 영속 결과 응답 DTO.
 *
 * @param persisted persisted snapshot 저장 성공 여부
 */
@Schema(description = "Y.Doc 스냅샷 영속 결과")
public record PersistYdocSnapshotResponse(
    @Schema(description = "persisted snapshot 저장 성공 여부")
    boolean persisted
) {}
