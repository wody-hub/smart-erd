package com.smarterd.domain.diagram.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.api.diagram.dto.UpdateDiagramDictionarySetRequest;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.DiagramRoomManager;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.service.DictionarySetService;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectService;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
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
    private TermRepository termRepository;

    @Mock
    private DomainRepository domainRepository;

    @Mock
    private ObjectMapper objectMapper;

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
        final var validTerm = createTerm(100L, team, targetSet);
        final var validDomain = createDomain(200L, team, targetSet);

        final var content = """
            {"nodes":[{"id":"table-1","data":{"tableTermId":9,"columns":[
            {"id":"c1","termId":11,"domainId":21},
            {"id":"c2","termId":100,"domainId":21},
            {"id":"c3","termId":11,"domainId":200}
            ]}}],"edges":[],"groups":[]}
            """;
        final var updatedContent = """
            {"nodes":[{"id":"table-1","data":{"columns":[
            {"id":"c1"},
            {"id":"c2","termId":100},
            {"id":"c3","domainId":200}
            ]}}],"edges":[],"groups":[]}
            """;

        final var diagram = Objects.requireNonNull(
            Diagram.builder().name("D").project(project).dictionarySet(targetSet).content(content).build()
        );
        ReflectionTestUtils.setField(diagram, "id", diagramId);
        diagram.updateYdocSnapshot(new byte[] { 1, 2, 3 });

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(projectService.findProjectById(projectId)).thenReturn(project);
        when(diagramRepository.findByProjectAndId(project, diagramId)).thenReturn(Optional.of(diagram));
        when(roomManager.getSessionCount(diagramId)).thenReturn(0);
        when(dictionarySetService.findByTeamAndId(team, targetSetId)).thenReturn(targetSet);
        when(termRepository.findByDictionarySet(targetSet)).thenReturn(List.of(validTerm));
        when(domainRepository.findByDictionarySet(targetSet)).thenReturn(List.of(validDomain));
        when(objectMapper.readTree(content)).thenReturn(new ObjectMapper().readTree(content));
        when(objectMapper.writeValueAsString(org.mockito.ArgumentMatchers.any())).thenReturn(
            new ObjectMapper().writeValueAsString(new ObjectMapper().readTree(updatedContent))
        );

        // when
        final var response = diagramService.updateDiagramDictionarySet(
            loginId,
            teamId,
            projectId,
            diagramId,
            new UpdateDiagramDictionarySetRequest(targetSetId)
        );

        // then
        assertThat(response.dictionarySetId()).isEqualTo(targetSetId);
        assertThat(response.invalidatedTermBindingCount()).isEqualTo(3);
        assertThat(response.invalidatedDomainBindingCount()).isEqualTo(2);
        assertThat(diagram.getYdocSnapshot()).isNull();
        assertThat(diagram.getContent()).contains("\"termId\":100");
        assertThat(diagram.getContent()).contains("\"domainId\":200");
        assertThat(diagram.getContent()).doesNotContain("\"termId\":11");
        assertThat(diagram.getContent()).doesNotContain("\"domainId\":21");
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
        when(diagramRepository.findByProjectAndId(project, diagramId)).thenReturn(Optional.of(diagram));
        when(roomManager.getSessionCount(diagramId)).thenReturn(0);
        when(dictionarySetService.findByTeamAndId(team, targetSetId)).thenReturn(targetSet);
        when(termRepository.findByDictionarySet(targetSet)).thenReturn(List.of());
        when(domainRepository.findByDictionarySet(targetSet)).thenReturn(List.of());
        when(objectMapper.readTree(content)).thenThrow(new JsonProcessingException("bad json") {});

        // when & then
        assertThatThrownBy(() ->
            diagramService.updateDiagramDictionarySet(
                loginId,
                teamId,
                projectId,
                diagramId,
                new UpdateDiagramDictionarySetRequest(targetSetId)
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
        when(diagramRepository.findByProjectAndId(project, diagramId)).thenReturn(Optional.of(diagram));
        when(roomManager.getSessionCount(diagramId)).thenReturn(1);

        // when & then
        assertThatThrownBy(() ->
            diagramService.updateDiagramDictionarySet(
                loginId,
                teamId,
                projectId,
                diagramId,
                new UpdateDiagramDictionarySetRequest(300L)
            )
        ).isInstanceOf(ConflictException.class);
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

    private Term createTerm(Long id, Team team, DictionarySet dictionarySet) {
        final var term = Objects.requireNonNull(
            Term.builder().logicalName("L").physicalName("P").team(team).dictionarySet(dictionarySet).build()
        );
        ReflectionTestUtils.setField(term, "id", id);
        return term;
    }

    private Domain createDomain(Long id, Team team, DictionarySet dictionarySet) {
        final var domain = Objects.requireNonNull(
            Domain.builder()
                .logicalName("D")
                .physicalType("VARCHAR(20)")
                .team(team)
                .dictionarySet(dictionarySet)
                .build()
        );
        ReflectionTestUtils.setField(domain, "id", id);
        return domain;
    }
}
