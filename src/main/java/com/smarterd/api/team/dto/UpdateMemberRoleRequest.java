package com.smarterd.api.team.dto;

import com.smarterd.domain.team.entity.TeamMemberRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 팀 멤버 역할 변경 요청 DTO.
 *
 * @param role 변경할 역할 (필수)
 */
@Schema(description = "멤버 역할 변경 요청")
public record UpdateMemberRoleRequest(
    @Schema(description = "변경할 역할 (ADMIN, MEMBER, VIEWER)", example = "VIEWER") @NotNull TeamMemberRole role
) {}
