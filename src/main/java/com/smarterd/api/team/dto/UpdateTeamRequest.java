package com.smarterd.api.team.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 팀 수정 요청 DTO.
 *
 * @param name 팀 이름 (필수, 1~100자)
 */
@Schema(description = "팀 수정 요청")
public record UpdateTeamRequest(
    @Schema(description = "팀 이름 (1~100자)", example = "Backend Team")
    @NotBlank(message = "{validation.not-blank.team-name}")
    @Size(min = 1, max = 100, message = "{validation.size.team-name}")
    String name
) {}
