package com.smarterd.domain.project.service;

import com.smarterd.api.project.dto.CreateProjectRequest;
import com.smarterd.api.project.dto.ProjectResponse;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.repository.ProjectRepository;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 프로젝트 관련 비즈니스 로직 서비스.
 *
 * <p>
 * 프로젝트 CRUD를 처리하며, 팀 소속 여부를 확인한다.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class ProjectService {

    /** 프로젝트 레포지토리 */
    private final ProjectRepository projectRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /**
     * 프로젝트를 생성한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 프로젝트 생성 요청
     * @return 생성된 프로젝트 응답
     */
    @Transactional
    public ProjectResponse createProject(String loginId, Long teamId, CreateProjectRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var project = Project.builder().name(request.name()).team(team).build();
        projectRepository.save(project);

        return ProjectResponse.from(project);
    }

    /**
     * 팀의 프로젝트 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 프로젝트 응답 목록
     */
    public List<ProjectResponse> getProjects(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return projectRepository.findByTeam(team).stream().map(ProjectResponse::from).toList();
    }

    /**
     * 프로젝트 상세를 조회한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 프로젝트 응답
     */
    public ProjectResponse getProject(String loginId, Long teamId, Long projectId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        return ProjectResponse.from(project);
    }

    /**
     * 프로젝트를 삭제한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     */
    @Transactional
    public void deleteProject(String loginId, Long teamId, Long projectId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        projectRepository.delete(project);
    }

    /**
     * 프로젝트 ID로 프로젝트를 조회한다.
     *
     * @param projectId 프로젝트 ID
     * @return 프로젝트 엔티티
     * @throws EntityNotFoundException 프로젝트가 존재하지 않는 경우
     */
    public Project findProjectById(Long projectId) {
        return projectRepository
            .findById(projectId)
            .orElseThrow(() -> new EntityNotFoundException("Project not found: " + projectId));
    }

    /**
     * 프로젝트가 해당 팀에 소속되어 있는지 확인한다.
     *
     * @param project 프로젝트 엔티티
     * @param teamId  팀 ID
     * @throws BusinessException 프로젝트가 해당 팀에 소속되지 않은 경우
     */
    public void verifyProjectBelongsToTeam(Project project, Long teamId) {
        if (!project.getTeam().getId().equals(teamId)) {
            throw new BusinessException("Project does not belong to this team");
        }
    }
}
