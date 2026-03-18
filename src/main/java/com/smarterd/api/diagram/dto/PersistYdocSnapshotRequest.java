package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 클라이언트가 현재 Y.Doc 스냅샷을 직접 영속화할 때 사용하는 요청 DTO.
 *
 * <p>JSON base64 문자열을 통해 전달되며, Spring이 {@code byte[]}로 자동 디코딩한다.</p>
 *
 * @param expectedContentRevision 현재 클라이언트가 기준으로 삼은 contentRevision
 * @param ydocSnapshot 현재 Y.Doc 전체 상태 update 바이트
 */
@Schema(description = "현재 Y.Doc 스냅샷 영속화 요청")
public record PersistYdocSnapshotRequest(
    @NotBlank
    @Schema(description = "클라이언트가 기준으로 삼은 contentRevision", example = "12")
    String expectedContentRevision,

    @NotNull
    @Schema(description = "현재 Y.Doc 전체 상태 update 바이트(base64)", format = "byte")
    byte[] ydocSnapshot
) {}
