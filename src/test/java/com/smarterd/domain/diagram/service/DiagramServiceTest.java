package com.smarterd.domain.diagram.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.service.DictionarySetService;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.Objects;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DiagramServiceTest {

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private AuthService authService;

    @Mock
    private TeamService teamService;

    @Mock
    private ProjectService projectService;

    @Mock
    private DictionarySetService dictionarySetService;

    @Mock
    private DiagramRoomManager roomManager;

    @Mock
    private DiagramSnapshotService diagramSnapshotService;

    @Mock
    private DiagramDictionaryBindingService diagramDictionaryBindingService;

    @InjectMocks
    private DiagramService diagramService;

    @Test
    @DisplayName(
        "updateDiagramDictionarySet - 변경 대상 세트 기준으로 term/domain 바인딩을 무효화하고 카운트를 반환한다"
    )
    void updateDiagramDictionarySet_invalidatesBindingsAndReturnsCounts() throws Exception {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var projectId = 10L;
        final var diagramId = 100L;
        final var targetSetId = 300L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(teamId, user);
        final var project = createProject(projectId, team);
        final var targetSet = createDictionarySet(targetSetId, team);
        final var invalidationCounts = new DiagramDictionaryBindingService.InvalidationCounts(3, 2);
        final var content = "{\"nodes\":[]}";

        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(project).dictionarySet(targetSet).content(content).build()
        );
        ReflectionTestUtils.setField(diagram, "id", diagramId);
        diagram.updateYdocSnapshot(new byte[] { 1, 2, 3 });

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, diagramId)).thenReturn(Optional.of(diagram));
        when(roomManager.getSessionCount(diagramId)).thenReturn(0);
        when(dictionarySetService.findByTeamAndId(team, targetSetId)).thenReturn(targetSet);
        when(diagramDictionaryBindingService.invalidateBindings(diagram, targetSet)).thenReturn(invalidationCounts);

        // when
        final var response = diagramService.updateDiagramDictionarySet(
            loginId,
            teamId,
            projectId,
            diagramId,
            targetSetId
        );

        // then
        assertThat(response.dictionarySetId()).isEqualTo(targetSetId);
        assertThat(response.invalidatedTermBindingCount()).isEqualTo(3);
        assertThat(response.invalidatedDomainBindingCount()).isEqualTo(2);
        assertThat(diagram.getYdocSnapshot()).isNull();
        verify(diagramDictionaryBindingService).invalidateBindings(diagram, targetSet);
    }

    @Test
    @DisplayName("updateDiagramDictionarySet - content JSON 파싱 실패면 400 예외를 던지고 세트 변경을 중단한다")
    void updateDiagramDictionarySet_whenContentJsonInvalid_throwsBusinessException() throws Exception {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var projectId = 10L;
        final var diagramId = 100L;
        final var currentSetId = 200L;
        final var targetSetId = 300L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(teamId, user);
        final var project = createProject(projectId, team);
        final var currentSet = createDictionarySet(currentSetId, team);
        final var targetSet = createDictionarySet(targetSetId, team);
        final var content = "{\"nodes\":[{\"id\":\"n1\"}]}";

        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(project).dictionarySet(currentSet).content(content).build()
        );
        ReflectionTestUtils.setField(diagram, "id", diagramId);
        diagram.updateYdocSnapshot(new byte[] { 1, 2, 3 });

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, diagramId)).thenReturn(Optional.of(diagram));
        when(roomManager.getSessionCount(diagramId)).thenReturn(0);
        when(dictionarySetService.findByTeamAndId(team, targetSetId)).thenReturn(targetSet);
        when(diagramDictionaryBindingService.invalidateBindings(diagram, targetSet)).thenThrow(
            new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code())
        );

        // when & then
        assertThatThrownBy(() ->
            diagramService.updateDiagramDictionarySet(
                loginId,
                teamId,
                projectId,
                diagramId,
                targetSetId
            )
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code());
        assertThat(diagram.getDictionarySet().getId()).isEqualTo(currentSetId);
        assertThat(diagram.getYdocSnapshot()).isNotNull();
    }

    @Test
    @DisplayName("updateDiagramDictionarySet - 편집 세션이 있으면 409 예외를 던진다")
    void updateDiagramDictionarySet_whenEditing_throwsConflictException() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var projectId = 10L;
        final var diagramId = 100L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(teamId, user);
        final var project = createProject(projectId, team);
        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(project).content("{\"nodes\":[]}").build()
        );
        ReflectionTestUtils.setField(diagram, "id", diagramId);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, diagramId)).thenReturn(Optional.of(diagram));
        when(roomManager.getSessionCount(diagramId)).thenReturn(1);

        // when & then
        assertThatThrownBy(() ->
            diagramService.updateDiagramDictionarySet(
                loginId,
                teamId,
                projectId,
                diagramId,
                300L
            )
        ).isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("deleteDiagram - 다이어그램을 논리 삭제하고 협업 room/snapshot 정리를 수행한다")
    void deleteDiagram_softDeletesDiagramAndClearsCollaborationState() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var projectId = 10L;
        final var diagramId = 100L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(teamId, user);
        final var project = createProject(projectId, team);
        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(project).content("{\"nodes\":[]}").build()
        );
        ReflectionTestUtils.setField(diagram, "id", diagramId);
        diagram.updateYdocSnapshot(new byte[] { 1, 2, 3 });

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, diagramId)).thenReturn(Optional.of(diagram));

        // when
        diagramService.deleteDiagram(loginId, teamId, projectId, diagramId);

        // then
        assertThat(diagram.isDeleted()).isTrue();
        assertThat(diagram.getYdocSnapshot()).isNull();
        assertThat(ReflectionTestUtils.getField(diagram, "deletedBy")).isEqualTo(loginId);
        verify(diagramSnapshotService).discardRealtimeStateAfterCommit(diagramId);
        verify(diagramRepository, never()).delete(diagram);
    }

    @Test
    @DisplayName("getDiagram - 논리 삭제된 다이어그램은 조회되지 않는다")
    void getDiagram_whenDiagramSoftDeleted_throwsEntityNotFoundException() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var projectId = 10L;
        final var diagramId = 100L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(teamId, user);
        final var project = createProject(projectId, team);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, diagramId)).thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> diagramService.getDiagram(loginId, teamId, projectId, diagramId))
            .isInstanceOf(EntityNotFoundException.class)
            .hasMessage(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code());
    }

    @Test
    @DisplayName("loadWritableDiagram - 쓰기 가능한 다이어그램 엔티티를 반환한다")
    void loadWritableDiagram_returnsWritableDiagram() {
        final var loginId = "tester";
        final var teamId = 1L;
        final var projectId = 10L;
        final var diagramId = 100L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(teamId, user);
        final var project = createProject(projectId, team);
        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(project).content("{\"nodes\":[]}").build()
        );
        ReflectionTestUtils.setField(diagram, "id", diagramId);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, diagramId)).thenReturn(Optional.of(diagram));

        final var loaded = diagramService.loadWritableDiagram(loginId, teamId, projectId, diagramId);

        assertThat(loaded).isSameAs(diagram);
    }

    @Test
    @DisplayName("buildSaveDiagramResult - 현재 다이어그램 상태를 저장 응답으로 변환한다")
    void buildSaveDiagramResult_returnsCurrentDiagramState() {
        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(createProject(10L, createTeam(1L, createUser(1L, "tester")))).build()
        );
        ReflectionTestUtils.setField(diagram, "id", 100L);
        diagram.updateYdocSnapshot(new byte[] { 1, 2, 3 });
        diagram.syncSnapshotRevision(diagram.getContentRevision());

        final var result = diagramService.buildSaveDiagramResult(diagram);

        assertThat(result.hasYdocSnapshot()).isTrue();
        assertThat(result.snapshotRevision()).isEqualTo(diagram.getSnapshotRevision());
    }

    private User createUser(Long id, String loginId) {
        final var user = Objects.requireNonNull(User.builder().loginId(loginId).password("pw").name("Tester").build());
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Team createTeam(Long id, User owner) {
        final var team = Objects.requireNonNull(Team.builder().name("Team").owner(owner).build());
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private Project createProject(Long id, Team team) {
        final var project = Objects.requireNonNull(Project.builder().name("Project").team(team).build());
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }

    private DictionarySet createDictionarySet(Long id, Team team) {
        final var dictionarySet = Objects.requireNonNull(
            DictionarySet.builder().team(team).name("Target").description("desc").isDefault(false).build()
        );
        ReflectionTestUtils.setField(dictionarySet, "id", id);
        return dictionarySet;
    }

}
