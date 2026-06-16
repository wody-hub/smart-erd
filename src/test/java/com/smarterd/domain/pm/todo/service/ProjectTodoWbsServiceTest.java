package com.smarterd.domain.pm.todo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.entity.TodoDocumentLink;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.todo.repository.TodoDocumentLinkRepository;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectTodoWbsServiceTest {

    @Mock
    private ProjectTodoAccessService projectTodoAccessService;

    @Mock
    private ProjectTodoRepository projectTodoRepository;

    @Mock
    private TodoDocumentLinkRepository todoDocumentLinkRepository;

    @Mock
    private ProjectTodoMapper projectTodoMapper;

    @Mock
    private WorkItemHistoryService workItemHistoryService;

    @InjectMocks
    private ProjectTodoWbsService projectTodoWbsService;

    @Test
    @DisplayName("getSharedTodoSummariesByWbs exposes only shared docs")
    void getSharedTodoSummariesByWbs_exposesOnlySharedDocs() {
        final var owner = createUser(1L, "tester", "김개발");
        final var project = createProject(20L, owner);
        final var wbsItem = createWbsItem(100L, project);
        final var todo = createTodo(301L, project, owner, wbsItem);
        final var sharedDoc = createDiagram(42L, project, "공유 문서");

        when(projectTodoAccessService.loadProject("tester", 10L, 20L)).thenReturn(project);
        when(projectTodoAccessService.findWbsItem(project, 100L)).thenReturn(wbsItem);
        when(
            projectTodoRepository.findByProjectAndLinkedWbsItemOrderByCreatedAtDescIdDesc(project, wbsItem)
        ).thenReturn(List.of(todo));
        when(
            todoDocumentLinkRepository.findByTodoInAndVisibility(List.of(todo), TodoDocumentVisibility.PROJECT_SHARED)
        ).thenReturn(List.of(createTodoDocumentLink(todo, sharedDoc, TodoDocumentVisibility.PROJECT_SHARED)));
        when(projectTodoMapper.toTodoDocumentResult(any(TodoDocumentLink.class))).thenReturn(
            new ProjectTodoService.TodoDocumentResult(
                301L,
                42L,
                "공유 문서",
                "markdown",
                null,
                null,
                "summary",
                List.of("spec"),
                TodoDocumentVisibility.PROJECT_SHARED,
                Instant.parse("2026-04-28T03:15:00Z"),
                Instant.parse("2026-04-28T03:10:00Z"),
                Instant.parse("2026-04-28T03:10:00Z")
            )
        );

        final var result = projectTodoWbsService.getSharedTodoSummariesByWbs("tester", 10L, 20L, 100L);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().sharedDocuments()).hasSize(1);
        assertThat(result.getFirst().sharedDocuments().getFirst().id()).isEqualTo(42L);
    }

    @Test
    @DisplayName("linkTodoToWbs records activity")
    void linkTodoToWbs_recordsActivity() {
        final var owner = createUser(1L, "tester", "김개발");
        final var project = createProject(20L, owner);
        final var todo = createTodo(301L, project, owner, null);
        final var wbsItem = createWbsItem(100L, project);
        final var mapped = new ProjectTodoService.ProjectTodoResult(
            301L,
            "응답 계약 정리",
            "private note",
            ProjectTodoStatus.TODO,
            ProjectTodoPriority.HIGH,
            LocalDate.parse("2026-04-30"),
            20,
            100L,
            "백엔드 API",
            Instant.parse("2026-04-28T03:00:00Z"),
            Instant.parse("2026-04-28T03:00:00Z")
        );

        when(projectTodoAccessService.loadProject("tester", 10L, 20L)).thenReturn(project);
        when(projectTodoAccessService.findOwnedTodo("tester", project, 301L)).thenReturn(todo);
        when(projectTodoAccessService.findWbsItem(project, 100L)).thenReturn(wbsItem);
        when(projectTodoMapper.toProjectTodoResult(todo)).thenReturn(mapped);

        final var result = projectTodoWbsService.linkTodoToWbs("tester", 10L, 20L, 301L, 100L);

        verify(workItemHistoryService).recordTodoWbsLinked(project, 301L, 100L, "백엔드 API", "tester");
        assertThat(result.linkedWbsItemId()).isEqualTo(100L);
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

    private WbsItem createWbsItem(Long id, Project project) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(null)
            .name("백엔드 API")
            .depth(0)
            .sortOrder(0)
            .assignee(null)
            .startDate(null)
            .endDate(null)
            .progressRate(0)
            .estimatedMm(null)
            .milestone(null)
            .build();
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }

    private ProjectTodo createTodo(Long id, Project project, User owner, WbsItem linkedWbsItem) {
        final var todo = ProjectTodo.builder()
            .project(project)
            .owner(owner)
            .linkedWbsItem(linkedWbsItem)
            .status(ProjectTodoStatus.TODO)
            .priority(ProjectTodoPriority.HIGH)
            .title("응답 계약 정리")
            .description("private note")
            .targetDate(LocalDate.parse("2026-04-30"))
            .progressRate(20)
            .build();
        ReflectionTestUtils.setField(todo, "id", id);
        ReflectionTestUtils.setField(todo, "createdAt", Instant.parse("2026-04-28T03:00:00Z"));
        ReflectionTestUtils.setField(todo, "updatedAt", Instant.parse("2026-04-28T03:00:00Z"));
        return todo;
    }

    private Diagram createDiagram(Long id, Project project, String name) {
        final var diagram = Diagram.builder()
            .name(name)
            .pluginId("markdown")
            .project(project)
            .content("# spec")
            .dictionarySet(null)
            .build();
        ReflectionTestUtils.setField(diagram, "id", id);
        ReflectionTestUtils.setField(diagram, "createdAt", Instant.parse("2026-04-28T03:10:00Z"));
        ReflectionTestUtils.setField(diagram, "updatedAt", Instant.parse("2026-04-28T03:10:00Z"));
        return diagram;
    }

    private TodoDocumentLink createTodoDocumentLink(
        ProjectTodo todo,
        Diagram diagram,
        TodoDocumentVisibility visibility
    ) {
        final var link = TodoDocumentLink.builder().todo(todo).diagram(diagram).visibility(visibility).build();
        ReflectionTestUtils.setField(link, "id", 1L);
        ReflectionTestUtils.setField(link, "createdAt", Instant.parse("2026-04-28T03:15:00Z"));
        ReflectionTestUtils.setField(link, "updatedAt", Instant.parse("2026-04-28T03:15:00Z"));
        return link;
    }
}
