package com.smarterd.api.team.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 팀 생성 요청 DTO.
 *
 * @param name 팀 이름 (필수, 1~100자)
 */
@Schema(description = "팀 생성 요청")
public record CreateTeamRequest(
    @Schema(description = "팀 이름 (1~100자)", example = "Backend Team") @NotBlank @Size(min = 1, max = 100) String name
) {}
