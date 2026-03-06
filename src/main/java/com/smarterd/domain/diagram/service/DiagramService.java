package com.smarterd.domain.diagram.service;

import com.smarterd.api.diagram.dto.CreateDiagramRequest;
import com.smarterd.api.diagram.dto.DiagramDetailResponse;
import com.smarterd.api.diagram.dto.DiagramResponse;
import com.smarterd.api.diagram.dto.RenameDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetResponse;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.entity.SaveSource;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.dictionary.service.DictionarySetService;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiagramService {

    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /** 프로젝트 서비스 (프로젝트 조회, 팀 귀속 확인) */
    private final ProjectService projectService;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /** 다이어그램 방 관리자 */
    private final DiagramRoomManager roomManager;

    /** 다이어그램 스냅샷 서비스 */
    private final DiagramSnapshotService diagramSnapshotService;

    /** 사전 바인딩 무효화 서비스 */
    private final DiagramDictionaryBindingService dictionaryBindingService;

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
        final var dictionarySet = dictionarySetService.findByTeamAndId(project.getTeam(), request.dictionarySetId());

        final var diagram = Diagram.builder()
            .name(request.name())
            .project(project)
            .dictionarySet(dictionarySet)
            .build();
        diagramRepository.save(Objects.requireNonNull(diagram));

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
     * <p>flushDiagramSnapshotNow + existsYdocSnapshotById 2쿼리를 제거하고
     * ydocSnapshot IS NOT NULL 기준으로 스냅샷 존재를 판단한다.</p>
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 다이어그램 상세 응답
     */
    public DiagramDetailResponse getDiagram(String loginId, Long teamId, Long projectId, Long diagramId) {
        final var project = verifyReadAccess(loginId, teamId, projectId);
        final var result = diagramRepository
            .findByProjectAndIdWithSnapshotFlag(project, diagramId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), diagramId));

        return DiagramDetailResponse.from(result.diagram(), project.getId(), result.hasYdocSnapshot());
    }

    /**
     * 다이어그램 콘텐츠를 저장한다 (YJS_BACKUP 원본).
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    저장 요청 (content)
     */
    @Transactional
    public void saveDiagram(String loginId, Long teamId, Long projectId, Long diagramId, SaveDiagramRequest request) {
        saveDiagram(loginId, teamId, projectId, diagramId, request, SaveSource.YJS_BACKUP);
    }

    /**
     * 다이어그램 콘텐츠를 저장한다.
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param request    저장 요청 (content)
     * @param source     저장 원본 구분
     */
    @Transactional
    public void saveDiagram(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        SaveDiagramRequest request,
        SaveSource source
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        switch (source) {
            case YJS_BACKUP -> {
                diagram.updateContent(request.content());
                diagram.incrementContentRevision();
            }
            case NON_YJS_UPDATE -> {
                if (roomManager.getSessionCount(diagramId) > 0) {
                    throw new ConflictException(MessageCode.ERROR_BUSINESS_DIAGRAM_SAVE_WHILE_EDITING.code());
                }
                diagram.updateContent(request.content());
                diagram.incrementContentRevision();
                diagram.nullifySnapshot();
            }
        }
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
     * 다이어그램의 사전 세트를 변경한다.
     *
     * @param loginId   요청 사용자 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param request   사전 세트 변경 요청
     * @return 변경 결과
     */
    @Transactional
    public UpdateDiagramDictionarySetResponse updateDiagramDictionarySet(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        UpdateDiagramDictionarySetRequest request
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        if (roomManager.getSessionCount(diagramId) > 0) {
            throw new ConflictException(MessageCode.ERROR_BUSINESS_DIAGRAM_DICTIONARY_SET_CHANGE_WHILE_EDITING.code());
        }

        final var dictionarySet = dictionarySetService.findByTeamAndId(project.getTeam(), request.dictionarySetId());
        final var counts = dictionaryBindingService.invalidateBindings(diagram, dictionarySet);
        diagram.changeDictionarySet(dictionarySet);
        diagram.nullifySnapshot();
        return new UpdateDiagramDictionarySetResponse(
            dictionarySet.getId(),
            counts.invalidatedTermBindingCount(),
            counts.invalidatedDomainBindingCount()
        );
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

        diagramRepository.delete(Objects.requireNonNull(diagram));
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
