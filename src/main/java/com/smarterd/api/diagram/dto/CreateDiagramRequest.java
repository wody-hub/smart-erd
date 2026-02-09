package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 다이어그램 생성 요청 DTO.
 *
 * @param name 다이어그램 이름 (필수, 1~100자)
 */
@Schema(description = "다이어그램 생성 요청")
public record CreateDiagramRequest(
    @Schema(description = "다이어그램 이름 (1~100자)", example = "Main ERD")
    @NotBlank
    @Size(min = 1, max = 100)
    String name
) {}
