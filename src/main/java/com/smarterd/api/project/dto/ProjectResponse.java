package com.smarterd.api.project.dto;

import com.smarterd.domain.project.entity.Project;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 프로젝트 응답 DTO.
 *
 * @param id        프로젝트 ID
 * @param name      프로젝트 이름
 * @param teamId    소속 팀 ID
 * @param createdAt 생성 시각
 */
@Schema(description = "프로젝트 응답")
public record ProjectResponse(
        @Schema(description = "프로젝트 ID", example = "1")
        Long id,

        @Schema(description = "프로젝트 이름", example = "E-Commerce ERD")
        String name,

        @Schema(description = "소속 팀 ID", example = "1")
        Long teamId,

        @Schema(description = "생성 시각")
        LocalDateTime createdAt
) {

    /**
     * Project 엔티티로부터 응답 DTO를 생성한다.
     *
     * @param project Project 엔티티
     * @return ProjectResponse
     */
    public static ProjectResponse from(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getTeam().getId(),
                project.getCreatedAt()
        );
    }
}
