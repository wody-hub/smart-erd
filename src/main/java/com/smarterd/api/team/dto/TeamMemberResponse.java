package com.smarterd.api.team.dto;

import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.entity.TeamMemberRole;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 팀 멤버 응답 DTO.
 *
 * @param userId  사용자 ID
 * @param loginId 로그인 ID
 * @param name    사용자 이름
 * @param role    팀 내 역할
 */
@Schema(description = "팀 멤버 응답")
public record TeamMemberResponse(
        @Schema(description = "사용자 ID", example = "1")
        Long userId,

        @Schema(description = "로그인 ID", example = "hong")
        String loginId,

        @Schema(description = "사용자 이름", example = "홍길동")
        String name,

        @Schema(description = "팀 내 역할", example = "ADMIN")
        TeamMemberRole role
) {

    /**
     * TeamMember 엔티티로부터 응답 DTO를 생성한다.
     *
     * @param member TeamMember 엔티티
     * @return TeamMemberResponse
     */
    public static TeamMemberResponse from(TeamMember member) {
        return new TeamMemberResponse(
                member.getUser().getId(),
                member.getUser().getLoginId(),
                member.getUser().getName(),
                member.getRole()
        );
    }
}
