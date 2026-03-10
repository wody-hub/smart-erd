package com.smarterd.domain.diagram.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.smarterd.api.diagram.dto.CreateDiagramRequest;
import com.smarterd.api.diagram.dto.DiagramDetailResponse;
import com.smarterd.api.diagram.dto.DiagramResponse;
import com.smarterd.api.diagram.dto.RenameDiagramRequest;
import com.smarterd.api.diagram.dto.SaveDiagramRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetRequest;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetResponse;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.service.DictionarySetService;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
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

    /** 용어 레포지토리 */
    private final TermRepository termRepository;

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** JSON 파서 */
    private final ObjectMapper objectMapper;

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
     * @param loginId    요청 사용자의 로그인 ID
     * @param teamId     팀 ID
     * @param projectId  프로젝트 ID
     * @param diagramId  다이어그램 ID
     * @return 다이어그램 상세 응답
     */
    public DiagramDetailResponse getDiagram(String loginId, Long teamId, Long projectId, Long diagramId) {
        final var project = verifyReadAccess(loginId, teamId, projectId);
        final var diagram = findDiagramByProjectAndId(project, diagramId);
        // 새로고침 직후에도 최신 상태를 반환하도록 조회 직전에 누적 update를 즉시 flush한다.
        diagramSnapshotService.flushDiagramSnapshotNow(diagram.getId());
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
        // content 저장 직후 stale snapshot 우선 로딩을 피하기 위해 기존 스냅샷을 무효화한다.
        diagram.updateYdocSnapshot(null);
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
        final var invalidationCounts = invalidateDictionaryBindings(diagram, dictionarySet);
        diagram.changeDictionarySet(dictionarySet);
        diagram.updateYdocSnapshot(null);
        return new UpdateDiagramDictionarySetResponse(
            dictionarySet.getId(),
            invalidationCounts.invalidatedTermBindingCount(),
            invalidationCounts.invalidatedDomainBindingCount()
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

    /**
     * 다이어그램 content의 term/domain 바인딩을 대상 세트 기준으로 정리한다.
     *
     * <p>세트에 존재하지 않는 termId/domainId는 제거한다.</p>
     *
     * @param diagram   대상 다이어그램
     * @param targetSet 변경 대상 사전 세트
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateDictionaryBindings(Diagram diagram, DictionarySet targetSet) {
        final var content = diagram.getContent();
        if (AppStringUtils.isBlank(content)) {
            return InvalidationCounts.empty();
        }

        final Set<Long> validTermIds = termRepository
            .findByDictionarySet(targetSet)
            .stream()
            .map((term) -> term.getId())
            .collect(Collectors.toSet());
        final Set<Long> validDomainIds = domainRepository
            .findByDictionarySet(targetSet)
            .stream()
            .map((domain) -> domain.getId())
            .collect(Collectors.toSet());

        try {
            final var rootNode = objectMapper.readTree(content);
            if (!(rootNode instanceof ObjectNode rootObject)) {
                return InvalidationCounts.empty();
            }

            final var counts = invalidateRootAndNodes(rootObject, validTermIds, validDomainIds);

            if (counts.invalidatedTermBindingCount() > 0 || counts.invalidatedDomainBindingCount() > 0) {
                diagram.updateContent(objectMapper.writeValueAsString(rootObject));
            }
            return counts;
        } catch (JsonProcessingException e) {
            log.warn("Failed to invalidate dictionary bindings for diagramId={}", diagram.getId(), e);
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code());
        }
    }

    /**
     * 루트 객체와 노드 배열의 바인딩을 무효화한다.
     *
     * @param rootObject    JSON 루트 객체
     * @param validTermIds  유효한 용어 ID 집합
     * @param validDomainIds 유효한 도메인 ID 집합
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateRootAndNodes(
        ObjectNode rootObject,
        Set<Long> validTermIds,
        Set<Long> validDomainIds
    ) {
        var invalidatedTermBindingCount = 0;
        var invalidatedDomainBindingCount = 0;

        final var tableTermId = toLongValue(rootObject.path("tableTermId"));
        if (tableTermId != null && !validTermIds.contains(tableTermId)) {
            rootObject.remove("tableTermId");
            invalidatedTermBindingCount++;
        }

        final var nodesNode = rootObject.get("nodes");
        if (nodesNode instanceof ArrayNode nodesArray) {
            for (final var node : nodesArray) {
                if (!(node instanceof ObjectNode nodeObject)) {
                    continue;
                }
                final var nodeCounts = invalidateNodeBindings(nodeObject, validTermIds, validDomainIds);
                invalidatedTermBindingCount += nodeCounts.invalidatedTermBindingCount();
                invalidatedDomainBindingCount += nodeCounts.invalidatedDomainBindingCount();
            }
        }

        return new InvalidationCounts(invalidatedTermBindingCount, invalidatedDomainBindingCount);
    }

    /**
     * 개별 노드의 data 객체에서 term/domain 바인딩을 무효화한다.
     *
     * @param nodeObject     노드 JSON 객체
     * @param validTermIds   유효한 용어 ID 집합
     * @param validDomainIds 유효한 도메인 ID 집합
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateNodeBindings(
        ObjectNode nodeObject,
        Set<Long> validTermIds,
        Set<Long> validDomainIds
    ) {
        final var dataNode = nodeObject.get("data");
        if (!(dataNode instanceof ObjectNode dataObject)) {
            return InvalidationCounts.empty();
        }

        var invalidatedTermBindingCount = 0;
        var invalidatedDomainBindingCount = 0;

        final var tableTermId = toLongValue(dataObject.get("tableTermId"));
        if (tableTermId != null && !validTermIds.contains(tableTermId)) {
            dataObject.remove("tableTermId");
            invalidatedTermBindingCount++;
        }

        final var columnsNode = dataObject.get("columns");
        if (columnsNode instanceof ArrayNode columnsArray) {
            final var columnCounts = invalidateColumnBindings(columnsArray, validTermIds, validDomainIds);
            invalidatedTermBindingCount += columnCounts.invalidatedTermBindingCount();
            invalidatedDomainBindingCount += columnCounts.invalidatedDomainBindingCount();
        }

        return new InvalidationCounts(invalidatedTermBindingCount, invalidatedDomainBindingCount);
    }

    /**
     * 컬럼 배열에서 term/domain 바인딩을 무효화한다.
     *
     * @param columnsArray   컬럼 JSON 배열
     * @param validTermIds   유효한 용어 ID 집합
     * @param validDomainIds 유효한 도메인 ID 집합
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateColumnBindings(
        ArrayNode columnsArray,
        Set<Long> validTermIds,
        Set<Long> validDomainIds
    ) {
        var invalidatedTermBindingCount = 0;
        var invalidatedDomainBindingCount = 0;

        for (final var columnNode : columnsArray) {
            if (!(columnNode instanceof ObjectNode columnObject)) {
                continue;
            }

            final var termId = toLongValue(columnObject.get("termId"));
            if (termId != null && !validTermIds.contains(termId)) {
                columnObject.remove("termId");
                invalidatedTermBindingCount++;
            }

            final var domainId = toLongValue(columnObject.get("domainId"));
            if (domainId != null && !validDomainIds.contains(domainId)) {
                columnObject.remove("domainId");
                invalidatedDomainBindingCount++;
            }
        }

        return new InvalidationCounts(invalidatedTermBindingCount, invalidatedDomainBindingCount);
    }

    @Nullable
    private Long toLongValue(JsonNode valueNode) {
        if (valueNode == null || valueNode.isNull()) {
            return null;
        }
        if (valueNode.canConvertToLong()) {
            return valueNode.longValue();
        }
        if (valueNode.isTextual()) {
            try {
                return Long.parseLong(valueNode.textValue());
            } catch (NumberFormatException e) {
                log.trace("텍스트를 Long으로 변환 불가: '{}'", valueNode.textValue(), e);
                return null;
            }
        }
        return null;
    }

    private record InvalidationCounts(int invalidatedTermBindingCount, int invalidatedDomainBindingCount) {
        private static InvalidationCounts empty() {
            return new InvalidationCounts(0, 0);
        }
    }
}
