package com.smarterd.api.team.dto;

import com.smarterd.domain.team.entity.TeamMemberRole;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 내 팀 역할 응답 DTO.
 *
 * @param role 팀 내 역할
 */
@Schema(description = "내 역할 응답")
public record MyRoleResponse(@Schema(description = "팀 내 역할", example = "ADMIN") TeamMemberRole role) {}
