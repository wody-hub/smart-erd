package com.smarterd.api.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 프로젝트 수정 요청 DTO.
 *
 * @param name        프로젝트 이름 (필수, 1~100자)
 * @param description 프로젝트 설명 (선택, 최대 500자)
 */
@Schema(description = "프로젝트 수정 요청")
public record UpdateProjectRequest(
    @Schema(description = "프로젝트 이름 (1~100자)", example = "E-Commerce ERD")
    @NotBlank(message = "{validation.not-blank.project-name}")
    @Size(min = 1, max = 100, message = "{validation.size.project-name}")
    String name,

    @Schema(description = "프로젝트 설명 (최대 500자)", example = "온라인 쇼핑몰 ERD")
    @Size(max = 500, message = "{validation.size.description}")
    String description
) {}
