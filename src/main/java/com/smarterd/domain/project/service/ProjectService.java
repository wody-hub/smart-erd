package com.smarterd.domain.project.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.repository.ProjectRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
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
public class ProjectService {

    /** 프로젝트 레포지토리 */
    private final ProjectRepository projectRepository;

    /** 다이어그램 레포지토리 (프로젝트 삭제 시 cascade용) */
    private final DiagramRepository diagramRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /**
     * 프로젝트를 생성한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param name 프로젝트 이름
     * @param description 프로젝트 설명
     * @return 생성된 프로젝트 결과
     */
    @Transactional
    public ProjectResult createProject(String loginId, Long teamId, String name, String description) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var project = Project.builder().name(name).description(description).team(team).build();
        projectRepository.save(Objects.requireNonNull(project));

        return toProjectResult(project);
    }

    /**
     * 팀의 프로젝트 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 프로젝트 결과 목록
     */
    public List<ProjectResult> getProjects(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return projectRepository.findByTeam(team).stream().map(this::toProjectResult).toList();
    }

    /**
     * 프로젝트 상세를 조회한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 프로젝트 결과
     */
    public ProjectResult getProject(String loginId, Long teamId, Long projectId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        return toProjectResult(project);
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
        teamService.verifyEditable(team, user);

        final var project = Objects.requireNonNull(findProjectById(projectId));
        verifyProjectBelongsToTeam(project, teamId);

        diagramRepository.deleteByProjectIn(List.of(project));
        projectRepository.delete(project);
    }

    /**
     * 프로젝트를 수정한다. (ADMIN/MEMBER 전용)
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param name 프로젝트 이름
     * @param description 프로젝트 설명
     * @return 수정된 프로젝트 결과
     */
    @Transactional
    public ProjectResult updateProject(String loginId, Long teamId, Long projectId, String name, String description) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        project.update(name, description);
        return toProjectResult(project);
    }

    /**
     * 프로젝트 사업 개요를 조회한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 사업 개요 결과
     */
    public BusinessOverviewResult getBusinessOverview(String loginId, Long teamId, Long projectId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        return toBusinessOverviewResult(project, team);
    }

    /**
     * 프로젝트 사업 개요를 수정한다.
     *
     * @param loginId           요청 사용자의 로그인 ID
     * @param teamId            팀 ID
     * @param projectId         프로젝트 ID
     * @param clientCompany     발주사
     * @param contractorCompany 수주사
     * @param contractAmount    계약 금액
     * @param projectStartDate  프로젝트 시작일
     * @param projectEndDate    프로젝트 종료일
     * @param projectScope      사업 범위
     * @return 수정된 사업 개요 결과
     */
    @Transactional
    public BusinessOverviewResult updateBusinessOverview(
        String loginId,
        Long teamId,
        Long projectId,
        @Nullable String clientCompany,
        @Nullable String contractorCompany,
        @Nullable Long contractAmount,
        @Nullable LocalDate projectStartDate,
        @Nullable LocalDate projectEndDate,
        @Nullable String projectScope
    ) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var project = findProjectById(projectId);
        verifyProjectBelongsToTeam(project, teamId);

        project.updateBusinessOverview(
            clientCompany,
            contractorCompany,
            contractAmount,
            projectStartDate,
            projectEndDate,
            projectScope
        );

        return toBusinessOverviewResult(project, team);
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
            .findById(Objects.requireNonNull(projectId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT.code(), projectId));
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
            throw new BusinessException(MessageCode.ERROR_BUSINESS_PROJECT_TEAM_MISMATCH.code());
        }
    }

    /**
     * 프로젝트 엔티티를 서비스 계층 결과로 변환한다.
     *
     * @param project 프로젝트 엔티티
     * @return 서비스 계층 결과
     */
    private ProjectResult toProjectResult(Project project) {
        return new ProjectResult(
            project.getId(),
            project.getName(),
            project.getDescription(),
            project.getTeam().getId(),
            project.getCreatedAt(),
            project.getUpdatedAt()
        );
    }

    /**
     * 프로젝트 엔티티를 사업 개요 서비스 결과로 변환한다.
     *
     * @param project 프로젝트 엔티티
     * @param team    프로젝트 소속 팀 엔티티
     * @return 사업 개요 서비스 결과
     */
    private BusinessOverviewResult toBusinessOverviewResult(Project project, Team team) {
        final var memberCount = teamService.countMembers(team);
        final var documentCount = diagramRepository.countByProjectAndDeletedAtIsNull(project);
        return new BusinessOverviewResult(
            project.getId(),
            project.getName(),
            project.getClientCompany(),
            project.getContractorCompany(),
            project.getContractAmount(),
            project.getProjectStartDate(),
            project.getProjectEndDate(),
            project.getProjectScope(),
            memberCount,
            documentCount,
            null
        );
    }

    /**
     * 프로젝트 사업 개요 응답용 서비스 결과.
     *
     * @param projectId         프로젝트 ID
     * @param projectName       프로젝트 이름
     * @param clientCompany     발주사
     * @param contractorCompany 수주사
     * @param contractAmount    계약 금액
     * @param projectStartDate  프로젝트 시작일
     * @param projectEndDate    프로젝트 종료일
     * @param projectScope      사업 범위
     * @param memberCount       프로젝트 팀 멤버 수
     * @param documentCount     프로젝트 문서(다이어그램) 수
     * @param progressRate      진행률 (Phase 4에서는 null)
     */
    public record BusinessOverviewResult(
        Long projectId,
        String projectName,
        @Nullable String clientCompany,
        @Nullable String contractorCompany,
        @Nullable Long contractAmount,
        @Nullable LocalDate projectStartDate,
        @Nullable LocalDate projectEndDate,
        @Nullable String projectScope,
        long memberCount,
        long documentCount,
        @Nullable Integer progressRate
    ) {}

    /**
     * 프로젝트 응답용 서비스 결과.
     *
     * @param id 프로젝트 ID
     * @param name 프로젝트 이름
     * @param description 프로젝트 설명
     * @param teamId 팀 ID
     * @param createdAt 생성 시각
     * @param updatedAt 수정 시각
     */
    public record ProjectResult(
        Long id,
        String name,
        String description,
        Long teamId,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
