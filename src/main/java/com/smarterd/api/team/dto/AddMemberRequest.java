package com.smarterd.api.team.dto;

import com.smarterd.domain.team.entity.TeamMemberRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 팀 멤버 추가(초대) 요청 DTO.
 *
 * @param loginId 초대할 사용자의 로그인 ID (필수, 최대 50자)
 * @param role    부여할 역할 (필수)
 */
@Schema(description = "멤버 초대 요청")
public record AddMemberRequest(
        @Schema(description = "초대할 사용자의 로그인 ID", example = "kim")
        @NotBlank @Size(max = 50) String loginId,

        @Schema(description = "부여할 역할 (ADMIN, MEMBER, VIEWER)", example = "MEMBER")
        @NotNull TeamMemberRole role
) {
}
