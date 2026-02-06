package com.smarterd.domain.project.service;

import com.smarterd.api.project.dto.CreateProjectRequest;
import com.smarterd.api.project.dto.ProjectResponse;
import com.smarterd.domain.common.exception.AccessDeniedException;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.repository.ProjectRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.team.repository.TeamRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
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

    /** 팀 레포지토리 */
    private final TeamRepository teamRepository;

    /** 팀 멤버 레포지토리 */
    private final TeamMemberRepository teamMemberRepository;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /**
     * 프로젝트를 생성한다.
     *
     * <p>
     * 요청 사용자가 해당 팀의 멤버여야 한다.
     * </p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 프로젝트 생성 요청
     * @return 생성된 프로젝트 응답
     */
    @Transactional
    public ProjectResponse createProject(String loginId, Long teamId, CreateProjectRequest request) {
        var user = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyMembership(team, user);

        var project = Project.builder().name(request.name()).team(team).build();
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
        var user = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyMembership(team, user);

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
        var user = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyMembership(team, user);

        var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        return ProjectResponse.from(project);
    }

    /**
     * 프로젝트를 삭제한다.
     *
     * <p>
     * 요청 사용자가 해당 팀의 멤버여야 한다.
     * </p>
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     */
    @Transactional
    public void deleteProject(String loginId, Long teamId, Long projectId) {
        var user = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyMembership(team, user);

        var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        projectRepository.delete(project);
    }

    private User findUserByLoginId(String loginId) {
        return userRepository
            .findByLoginId(loginId)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + loginId));
    }

    private Team findTeamById(Long teamId) {
        return teamRepository
            .findById(teamId)
            .orElseThrow(() -> new EntityNotFoundException("Team not found: " + teamId));
    }

    private Project findProjectById(Long projectId) {
        return projectRepository
            .findById(projectId)
            .orElseThrow(() -> new EntityNotFoundException("Project not found: " + projectId));
    }

    private void verifyMembership(Team team, User user) {
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new AccessDeniedException("User is not a member of this team");
        }
    }

    private void verifyProjectBelongsToTeam(Project project, Long teamId) {
        if (!project.getTeam().getId().equals(teamId)) {
            throw new BusinessException("Project does not belong to this team");
        }
    }
}
