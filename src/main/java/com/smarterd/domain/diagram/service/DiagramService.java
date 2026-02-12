package com.smarterd.domain.diagram.service;

import com.smarterd.api.diagram.dto.CreateDiagramRequest;
import com.smarterd.api.diagram.dto.DiagramDetailResponse;
import com.smarterd.api.diagram.dto.DiagramResponse;
import com.smarterd.api.diagram.dto.RenameDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 관련 비즈니스 로직 서비스.
 *
 * <p>
 * 다이어그램 CRUD를 처리하며, 팀 소속 여부 및 프로젝트 귀속을 확인한다.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class DiagramService {

    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /** 프로젝트 서비스 (프로젝트 조회, 팀 귀속 확인) */
    private final ProjectService projectService;

    /**
     * 다이어그램을 생성한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param request   다이어그램 생성 요청
     * @return 생성된 다이어그램 응답
     */
    @Transactional
    public DiagramResponse createDiagram(String loginId, Long teamId, Long projectId, CreateDiagramRequest request) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);

        final var diagram = Diagram.builder().name(request.name()).project(project).build();
        diagramRepository.save(diagram);

        return DiagramResponse.from(diagram, project.getId());
    }

    /**
     * 프로젝트의 다이어그램 목록을 조회한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 다이어그램 응답 목록
     */
    public List<DiagramResponse> getDiagrams(String loginId, Long teamId, Long projectId) {
        final var project = verifyReadAccess(loginId, teamId, projectId);
        final var pid = project.getId();

        return diagramRepository
            .findByProject(project)
            .stream()
            .map((d) -> DiagramResponse.from(d, pid))
            .toList();
    }

    /**
     * 다이어그램 상세를 조회한다 (content 포함).
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 다이어그램 상세 응답
     */
    public DiagramDetailResponse getDiagram(String loginId, Long teamId, Long projectId, Long diagramId) {
        final var project = verifyReadAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);
        final var hasSnapshot = diagramRepository.existsYdocSnapshotById(diagramId);

        return DiagramDetailResponse.from(diagram, project.getId(), hasSnapshot);
    }

    /**
     * 다이어그램 콘텐츠를 저장한다.
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    저장 요청 (content)
     */
    @Transactional
    public void saveDiagram(String loginId, Long teamId, Long projectId, Long diagramId, SaveDiagramRequest request) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        diagram.updateContent(request.content());
    }

    /**
     * 다이어그램 이름을 변경한다.
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    이름 변경 요청
     * @return 다이어그램 응답
     */
    @Transactional
    public DiagramResponse renameDiagram(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        RenameDiagramRequest request
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        diagram.rename(request.name());

        return DiagramResponse.from(diagram, project.getId());
    }

    /**
     * 다이어그램을 삭제한다.
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     */
    @Transactional
    public void deleteDiagram(String loginId, Long teamId, Long projectId, Long diagramId) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        diagramRepository.delete(diagram);
    }

    /**
     * 읽기 전용 접근을 검증한다. 모든 팀 멤버가 접근 가능하다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 프로젝트 엔티티
     */
    private Project verifyReadAccess(String loginId, Long teamId, Long projectId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var project = projectService.findProjectById(projectId);
        projectService.verifyProjectBelongsToTeam(project, teamId);

        return project;
    }

    /**
     * 쓰기 접근을 검증한다. ADMIN과 MEMBER만 접근 가능하다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 프로젝트 엔티티
     */
    private Project verifyWriteAccess(String loginId, Long teamId, Long projectId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var project = projectService.findProjectById(projectId);
        projectService.verifyProjectBelongsToTeam(project, teamId);

        return project;
    }

    /**
     * 프로젝트와 ID로 다이어그램을 조회한다.
     *
     * @param project   프로젝트 엔티티
     * @param diagramId 다이어그램 ID
     * @return 다이어그램 엔티티
     * @throws EntityNotFoundException 다이어그램이 존재하지 않는 경우
     */
    private Diagram findDiagramByProjectAndId(Project project, Long diagramId) {
        return diagramRepository
            .findByProjectAndId(project, diagramId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), diagramId));
    }
}
