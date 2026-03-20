package com.smarterd.domain.diagram.service;

import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.service.DiagramDictionaryBindingService.InvalidationCounts;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.dictionary.service.DictionarySetService;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
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

    /** 다이어그램 사전 바인딩 정리 서비스 */
    private final DiagramDictionaryBindingService diagramDictionaryBindingService;

    /**
     * 다이어그램을 생성한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param name      다이어그램 이름
     * @param dictionarySetId 사전 세트 ID
     * @return 생성된 다이어그램 요약 결과
     */
    @Transactional
    public DiagramSummaryResult createDiagram(
        String loginId,
        Long teamId,
        Long projectId,
        String name,
        Long dictionarySetId
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(project.getTeam(), dictionarySetId);

        final var diagram = Diagram.builder()
            .name(name)
            .project(project)
            .dictionarySet(dictionarySet)
            .build();
        diagramRepository.save(Objects.requireNonNull(diagram));

        return toDiagramSummaryResult(diagram, project.getId());
    }

    /**
     * 프로젝트의 다이어그램 목록을 조회한다.
     *
     * @param loginId   요청 사용자의 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 다이어그램 요약 결과 목록
     */
    public List<DiagramSummaryResult> getDiagrams(String loginId, Long teamId, Long projectId) {
        final var project = verifyReadAccess(loginId, teamId, projectId);
        final var pid = project.getId();

        return diagramRepository
            .findByProjectAndDeletedAtIsNull(project)
            .stream()
            .map((diagram) -> toDiagramSummaryResult(diagram, pid))
            .toList();
    }

    /**
     * 다이어그램 상세를 조회한다 (content 포함).
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 다이어그램 상세 결과
     */
    public DiagramDetailResult getDiagram(String loginId, Long teamId, Long projectId, Long diagramId) {
        final var project = verifyReadAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);
        final var hasSnapshot = diagramRepository.existsYdocSnapshotById(diagramId);

        return toDiagramDetailResult(diagram, project.getId(), hasSnapshot);
    }

    /**
     * 다이어그램 콘텐츠를 저장한다.
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param content    저장할 직렬화된 React Flow JSON
     * @param ydocSnapshot 저장 시점의 현재 Y.Doc 전체 상태 update
     * @return 최신 저장 상태 결과
     */
    @Transactional
    public SaveDiagramResult saveDiagram(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        String content,
        byte[] ydocSnapshot
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        diagram.updateContent(content);
        if (ydocSnapshot != null && ydocSnapshot.length > 0) {
            diagram.updateYdocSnapshot(YjsUpdateFormat.encode(List.of(ydocSnapshot)));
            diagram.syncSnapshotRevision(diagram.getContentRevision());
        }
        diagramSnapshotService.reconcileRealtimeStateWithPersistedContentAfterCommit(diagramId, ydocSnapshot);
        return toSaveDiagramResult(diagram);
    }

    /**
     * 클라이언트가 보낸 현재 Y.Doc 전체 상태를 persisted snapshot으로 저장한다.
     *
     * <p>코드 모드 shared draft를 세션 간 복원할 수 있도록 keepalive/idle 경로에서 사용한다.</p>
     *
     * @param loginId   요청 사용자 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param expectedContentRevision 클라이언트가 기대하는 content 리비전
     * @param ydocSnapshot            클라이언트의 현재 Y.Doc 스냅샷
     */
    @Transactional
    public void persistYdocSnapshot(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        String expectedContentRevision,
        byte[] ydocSnapshot
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        findDiagramByProjectAndId(project, diagramId);
        diagramSnapshotService.replaceSnapshotWithClientState(
            diagramId,
            expectedContentRevision,
            ydocSnapshot
        );
    }

    /**
     * 다이어그램 이름을 변경한다.
     *
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @param name       변경할 다이어그램 이름
     * @return 다이어그램 요약 결과
     */
    @Transactional
    public DiagramSummaryResult renameDiagram(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        String name
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        diagram.rename(name);

        return toDiagramSummaryResult(diagram, project.getId());
    }

    /**
     * 다이어그램의 사전 세트를 변경한다.
     *
     * @param loginId   요청 사용자 로그인 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param dictionarySetId 변경할 사전 세트 ID
     * @return 변경 결과
     */
    @Transactional
    public DictionarySetChangeResult updateDiagramDictionarySet(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        Long dictionarySetId
    ) {
        final var project = verifyWriteAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);

        if (roomManager.getSessionCount(diagramId) > 0) {
            throw new ConflictException(MessageCode.ERROR_BUSINESS_DIAGRAM_DICTIONARY_SET_CHANGE_WHILE_EDITING.code());
        }

        final var dictionarySet = dictionarySetService.findByTeamAndId(project.getTeam(), dictionarySetId);
        final var invalidationCounts = diagramDictionaryBindingService.invalidateBindings(diagram, dictionarySet);
        diagram.changeDictionarySet(dictionarySet);
        diagram.nullifySnapshot();
        diagramSnapshotService.discardRealtimeStateAfterCommit(diagramId);
        return new DictionarySetChangeResult(
            dictionarySet.getId(),
            invalidationCounts.invalidatedTermBindingCount(),
            invalidationCounts.invalidatedDomainBindingCount()
        );
    }

    /**
     * 다이어그램을 논리 삭제한다.
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
        final var resolvedDiagramId = Objects.requireNonNull(diagram.getId());
        diagram.softDelete(loginId);
        diagram.nullifySnapshot();
        diagramSnapshotService.discardRealtimeStateAfterCommit(resolvedDiagramId);
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
            .findByProjectAndIdAndDeletedAtIsNull(project, diagramId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), diagramId));
    }

    /**
     * Diagram 엔티티를 목록/이름변경 응답용 결과로 변환한다.
     *
     * @param diagram    다이어그램 엔티티
     * @param projectId  소속 프로젝트 ID
     * @return 서비스 계층 목록 결과
     */
    private DiagramSummaryResult toDiagramSummaryResult(Diagram diagram, Long projectId) {
        final var dictionarySet = diagram.getDictionarySet();
        return new DiagramSummaryResult(
            diagram.getId(),
            diagram.getName(),
            projectId,
            dictionarySet != null ? dictionarySet.getId() : null,
            dictionarySet != null ? dictionarySet.getName() : null,
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }

    /**
     * Diagram 엔티티를 상세 조회용 결과로 변환한다.
     *
     * @param diagram          다이어그램 엔티티
     * @param projectId        소속 프로젝트 ID
     * @param hasYdocSnapshot  Y.Doc 스냅샷 존재 여부
     * @return 서비스 계층 상세 결과
     */
    private DiagramDetailResult toDiagramDetailResult(Diagram diagram, Long projectId, boolean hasYdocSnapshot) {
        final var dictionarySet = diagram.getDictionarySet();
        return new DiagramDetailResult(
            diagram.getId(),
            diagram.getName(),
            projectId,
            dictionarySet != null ? dictionarySet.getId() : null,
            dictionarySet != null ? dictionarySet.getName() : null,
            diagram.getContent(),
            hasYdocSnapshot,
            diagram.getContentRevision(),
            diagram.getSnapshotRevision(),
            diagram.getSnapshotUpdatedAt(),
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }

    /**
     * Diagram 엔티티를 저장 응답용 결과로 변환한다.
     *
     * @param diagram 저장 직후 다이어그램 엔티티
     * @return 서비스 계층 저장 결과
     */
    private SaveDiagramResult toSaveDiagramResult(Diagram diagram) {
        return new SaveDiagramResult(
            diagram.getContentRevision(),
            diagram.getYdocSnapshot() != null,
            diagram.getSnapshotRevision(),
            diagram.getSnapshotUpdatedAt(),
            diagram.getUpdatedAt()
        );
    }

    /**
     * 다이어그램 목록/이름변경 응답용 서비스 결과.
     *
     * @param id                다이어그램 ID
     * @param name              다이어그램 이름
     * @param projectId         소속 프로젝트 ID
     * @param dictionarySetId   사전 세트 ID
     * @param dictionarySetName 사전 세트 이름
     * @param createdAt         생성 시각
     * @param updatedAt         수정 시각
     */
    public record DiagramSummaryResult(
        Long id,
        String name,
        Long projectId,
        Long dictionarySetId,
        String dictionarySetName,
        Instant createdAt,
        Instant updatedAt
    ) {}

    /**
     * 다이어그램 상세 응답용 서비스 결과.
     *
     * @param id                다이어그램 ID
     * @param name              다이어그램 이름
     * @param projectId         소속 프로젝트 ID
     * @param dictionarySetId   사전 세트 ID
     * @param dictionarySetName 사전 세트 이름
     * @param content           직렬화된 React Flow JSON
     * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부
     * @param contentRevision   content 리비전
     * @param snapshotRevision  snapshot 리비전
     * @param snapshotUpdatedAt snapshot 저장 시각
     * @param createdAt         생성 시각
     * @param updatedAt         수정 시각
     */
    public record DiagramDetailResult(
        Long id,
        String name,
        Long projectId,
        Long dictionarySetId,
        String dictionarySetName,
        String content,
        boolean hasYdocSnapshot,
        long contentRevision,
        Long snapshotRevision,
        Instant snapshotUpdatedAt,
        Instant createdAt,
        Instant updatedAt
    ) {}

    /**
     * 다이어그램 저장 응답용 서비스 결과.
     *
     * @param contentRevision   최신 content 리비전
     * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부
     * @param snapshotRevision  snapshot 리비전
     * @param snapshotUpdatedAt snapshot 저장 시각
     * @param updatedAt         최종 수정 시각
     */
    public record SaveDiagramResult(
        long contentRevision,
        boolean hasYdocSnapshot,
        Long snapshotRevision,
        Instant snapshotUpdatedAt,
        Instant updatedAt
    ) {}

    /**
     * 다이어그램 사전 세트 변경 결과.
     *
     * @param dictionarySetId              변경된 사전 세트 ID
     * @param invalidatedTermBindingCount  무효화된 term 바인딩 수
     * @param invalidatedDomainBindingCount 무효화된 domain 바인딩 수
     */
    public record DictionarySetChangeResult(
        Long dictionarySetId,
        int invalidatedTermBindingCount,
        int invalidatedDomainBindingCount
    ) {}
}
