package com.smarterd.api.team.dto;

import com.smarterd.domain.team.entity.Team;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 팀 응답 DTO.
 *
 * @param id          팀 ID
 * @param name        팀 이름
 * @param ownerName   소유자 이름
 * @param memberCount 멤버 수
 * @param createdAt   생성 시각
 */
@Schema(description = "팀 응답")
public record TeamResponse(
        @Schema(description = "팀 ID", example = "1")
        Long id,

        @Schema(description = "팀 이름", example = "Backend Team")
        String name,

        @Schema(description = "소유자 이름", example = "홍길동")
        String ownerName,

        @Schema(description = "멤버 수", example = "3")
        int memberCount,

        @Schema(description = "생성 시각")
        LocalDateTime createdAt
) {

    /**
     * Team 엔티티로부터 응답 DTO를 생성한다.
     *
     * @param team Team 엔티티
     * @return TeamResponse
     */
    public static TeamResponse from(Team team) {
        return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getOwner().getName(),
                team.getMembers().size(),
                team.getCreatedAt()
        );
    }
}
