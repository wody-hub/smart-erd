package com.smarterd.domain.pm.common;

import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * PM 도메인 공통 프로젝트 컨텍스트 로더.
 *
 * <p>WBS/마일스톤 서비스에서 반복되는 사용자·팀·프로젝트 검증 로직을 추출한다.</p>
 */
@Component
@RequiredArgsConstructor
public class ProjectContextLoader {

    private final AuthService authService;
    private final TeamService teamService;
    private final ProjectService projectService;

    /**
     * 프로젝트 컨텍스트를 로드하고 권한을 검증한다.
     *
     * @param loginId   요청 사용자 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param editable  쓰기 권한 필요 여부
     * @return 프로젝트 컨텍스트
     */
    public ProjectContext load(String loginId, Long teamId, Long projectId, boolean editable) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        if (editable) {
            teamService.verifyEditable(team, user);
        } else {
            teamService.verifyMembership(team, user);
        }

        final var project = projectService.findProjectById(projectId);
        projectService.verifyProjectBelongsToTeam(project, teamId);
        return new ProjectContext(team, project);
    }

    /**
     * 프로젝트 컨텍스트.
     *
     * @param team    팀 엔티티
     * @param project 프로젝트 엔티티
     */
    public record ProjectContext(Team team, Project project) {}
}
