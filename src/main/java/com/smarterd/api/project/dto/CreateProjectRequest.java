package com.smarterd.api.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 프로젝트 생성 요청 DTO.
 *
 * @param name 프로젝트 이름 (필수, 1~100자)
 */
@Schema(description = "프로젝트 생성 요청")
public record CreateProjectRequest(
        @Schema(description = "프로젝트 이름 (1~100자)", example = "E-Commerce ERD")
        @NotBlank @Size(min = 1, max = 100) String name
) {
}
