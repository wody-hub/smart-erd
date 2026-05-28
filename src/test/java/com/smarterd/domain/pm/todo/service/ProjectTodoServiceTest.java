package com.smarterd.domain.pm.todo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.todo.repository.TodoDocumentLinkRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectTodoServiceTest {

    @Mock
    private ProjectTodoAccessService projectTodoAccessService;

    @Mock
    private ProjectTodoRepository projectTodoRepository;

    @Mock
    private TodoDocumentLinkRepository todoDocumentLinkRepository;

    @Mock
    private ProjectTodoMapper projectTodoMapper;

    @Mock
    private ProjectTodoDocumentService projectTodoDocumentService;

    @Mock
    private ProjectTodoWbsService projectTodoWbsService;

    @Mock
    private com.smarterd.domain.pm.history.service.WorkItemHistoryService workItemHistoryService;

    @InjectMocks
    private ProjectTodoService projectTodoService;

    @Test
    @DisplayName("getProjectTodos delegates lookup and maps results")
    void getProjectTodos_delegatesLookupAndMapsResults() {
        final var owner = createUser(1L, "tester", "김개발");
        final var project = createProject(20L, owner);
        final var todo = createTodo(301L, project, owner);
        final var mapped = new ProjectTodoService.ProjectTodoResult(
            301L,
            "응답 계약 정리",
            "private note",
            ProjectTodoStatus.TODO,
            ProjectTodoPriority.HIGH,
            null,
            20,
            null,
            null,
            Instant.parse("2026-04-28T03:00:00Z"),
            Instant.parse("2026-04-28T03:00:00Z")
        );

        when(projectTodoAccessService.loadProject("tester", 10L, 20L)).thenReturn(project);
        when(projectTodoAccessService.findUserByLoginId("tester")).thenReturn(owner);
        when(projectTodoRepository.findByProjectAndOwnerOrderByCreatedAtDescIdDesc(project, owner)).thenReturn(List.of(todo));
        when(projectTodoMapper.toProjectTodoResult(todo)).thenReturn(mapped);

        final var result = projectTodoService.getProjectTodos("tester", 10L, 20L);

        assertThat(result).containsExactly(mapped);
    }

    @Test
    @DisplayName("createProjectTodo applies defaults before save")
    void createProjectTodo_appliesDefaultsBeforeSave() {
        final var owner = createUser(1L, "tester", "김개발");
        final var project = createProject(20L, owner);

        when(projectTodoAccessService.loadProject("tester", 10L, 20L)).thenReturn(project);
        when(projectTodoAccessService.findUserByLoginId("tester")).thenReturn(owner);
        when(projectTodoAccessService.resolveWbsItem(project, null)).thenReturn(null);
        when(projectTodoRepository.save(any(ProjectTodo.class))).thenAnswer((invocation) -> invocation.getArgument(0, ProjectTodo.class));
        when(projectTodoMapper.toProjectTodoResult(any(ProjectTodo.class)))
            .thenAnswer((invocation) -> {
                final var saved = invocation.getArgument(0, ProjectTodo.class);
                return new ProjectTodoService.ProjectTodoResult(
                    saved.getId(),
                    saved.getTitle(),
                    saved.getDescription(),
                    saved.getStatus(),
                    saved.getPriority(),
                    saved.getTargetDate(),
                    saved.getProgressRate(),
                    null,
                    null,
                    Instant.EPOCH,
                    Instant.EPOCH
                );
            });

        final var result = projectTodoService.createProjectTodo(
            "tester",
            10L,
            20L,
            new ProjectTodoService.CreateProjectTodoCommand("응답 계약 정리", "private note", null, null, null, null, null)
        );

        assertThat(result.status()).isEqualTo(ProjectTodoStatus.TODO);
        assertThat(result.priority()).isEqualTo(ProjectTodoPriority.MEDIUM);
        assertThat(result.progressRate()).isZero();
    }

    @Test
    @DisplayName("document operations delegate to dedicated service")
    void documentOperations_delegateToDedicatedService() {
        final var expected = new ProjectTodoService.TodoDocumentResult(
            301L,
            41L,
            "공유 문서",
            "markdown",
            null,
            null,
            "summary",
            List.of(),
            com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility.PRIVATE,
            Instant.parse("2026-04-28T03:10:00Z"),
            Instant.parse("2026-04-28T03:10:00Z"),
            Instant.parse("2026-04-28T03:10:00Z")
        );
        when(projectTodoDocumentService.linkDocument("tester", 10L, 20L, 301L, 41L, com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility.PRIVATE))
            .thenReturn(expected);

        final var result = projectTodoService.linkDocument(
            "tester",
            10L,
            20L,
            301L,
            41L,
            com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility.PRIVATE
        );

        assertThat(result).isEqualTo(expected);
        verify(projectTodoDocumentService).linkDocument("tester", 10L, 20L, 301L, 41L, com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility.PRIVATE);
    }

    @Test
    @DisplayName("deleteProjectTodo removes linked documents before deleting the todo")
    void deleteProjectTodo_removesLinkedDocumentsBeforeDeletingTodo() {
        final var owner = createUser(1L, "tester", "김개발");
        final var project = createProject(20L, owner);
        final var todo = createTodo(301L, project, owner);

        when(projectTodoAccessService.loadProject("tester", 10L, 20L)).thenReturn(project);
        when(projectTodoAccessService.findOwnedTodo("tester", project, 301L)).thenReturn(todo);

        projectTodoService.deleteProjectTodo("tester", 10L, 20L, 301L);

        verify(todoDocumentLinkRepository).deleteByTodo(todo);
        verify(projectTodoRepository).delete(todo);
    }

    private User createUser(Long id, String loginId, String name) {
        final var user = User.builder().loginId(loginId).password("encoded").name(name).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Project createProject(Long id, User owner) {
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", 10L);
        final var project = Project.builder().name("Project").description("desc").team(team).build();
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }

    private ProjectTodo createTodo(Long id, Project project, User owner) {
        final var todo = ProjectTodo.builder()
            .project(project)
            .owner(owner)
            .status(ProjectTodoStatus.TODO)
            .priority(ProjectTodoPriority.HIGH)
            .title("응답 계약 정리")
            .description("private note")
            .progressRate(20)
            .build();
        ReflectionTestUtils.setField(todo, "id", id);
        return todo;
    }
}
