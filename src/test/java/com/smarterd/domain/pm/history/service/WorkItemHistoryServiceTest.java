package com.smarterd.domain.pm.history.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.history.entity.WorkActivity;
import com.smarterd.domain.pm.history.entity.WorkActivityEventType;
import com.smarterd.domain.pm.history.entity.WorkActivitySubjectType;
import com.smarterd.domain.pm.history.entity.WorkComment;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.pm.history.repository.WorkActivityRepository;
import com.smarterd.domain.pm.history.repository.WorkCommentRepository;
import com.smarterd.domain.pm.issue.repository.ProjectIssueRepository;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
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
class WorkItemHistoryServiceTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private ProjectIssueRepository projectIssueRepository;

    @Mock
    private ProjectTodoRepository projectTodoRepository;

    @Mock
    private WorkCommentRepository workCommentRepository;

    @Mock
    private WorkActivityRepository workActivityRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private WorkItemHistoryService workItemHistoryService;

    @Test
    @DisplayName("addWbsComment saves comment and resolves actor name")
    void addWbsComment_savesComment() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var wbsItem = createWbsItem(100L, project);
        final var actor = createUser(7L, "tester", "김개발");
        final var saved = WorkComment.builder()
            .project(project)
            .targetType(WorkTargetType.WBS)
            .targetId(100L)
            .content("첫 댓글")
            .build();
        saved.initializeAuditActor("tester");
        ReflectionTestUtils.setField(saved, "id", 301L);
        ReflectionTestUtils.setField(saved, "createdAt", Instant.parse("2026-04-28T01:00:00Z"));
        ReflectionTestUtils.setField(saved, "updatedAt", Instant.parse("2026-04-28T01:00:00Z"));

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(wbsItem));
        when(workCommentRepository.save(any(WorkComment.class))).thenReturn(saved);
        when(userRepository.findByLoginIdIn(List.of("tester"))).thenReturn(List.of(actor));

        final var result = workItemHistoryService.addWbsComment("tester", 10L, 20L, 100L, "첫 댓글");

        assertThat(result.id()).isEqualTo(301L);
        assertThat(result.actorName()).isEqualTo("김개발");
        assertThat(result.content()).isEqualTo("첫 댓글");
    }

    @Test
    @DisplayName("getWbsActivities maps actor and subject payload")
    void getWbsActivities_mapsActorAndSubject() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var wbsItem = createWbsItem(100L, project);
        final var actor = createUser(7L, "tester", "김개발");
        final var activity = WorkActivity.builder()
            .project(project)
            .targetType(WorkTargetType.WBS)
            .targetId(100L)
            .eventType(WorkActivityEventType.DOCUMENT_LINKED)
            .subjectType(WorkActivitySubjectType.DOCUMENT)
            .subjectId(42L)
            .subjectLabel("API Spec")
            .detail("Linked document to WBS item")
            .build();
        activity.initializeAuditActor("tester");
        ReflectionTestUtils.setField(activity, "id", 401L);
        ReflectionTestUtils.setField(activity, "createdAt", Instant.parse("2026-04-28T01:10:00Z"));

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(wbsItem));
        when(workActivityRepository.findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtDescIdDesc(project, WorkTargetType.WBS, 100L))
            .thenReturn(List.of(activity));
        when(userRepository.findByLoginIdIn(List.of("tester"))).thenReturn(List.of(actor));

        final var result = workItemHistoryService.getWbsActivities("tester", 10L, 20L, 100L);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().subjectLabel()).isEqualTo("API Spec");
        assertThat(result.getFirst().actorName()).isEqualTo("김개발");
    }

    @Test
    @DisplayName("recordWbsDocumentLinked persists activity row")
    void recordWbsDocumentLinked_persistsActivity() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var wbsItem = createWbsItem(100L, project);

        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(wbsItem));

        workItemHistoryService.recordWbsDocumentLinked(project, 100L, 42L, "API Spec", "tester");

        verify(workActivityRepository).save(any(WorkActivity.class));
    }

    @Test
    @DisplayName("recordTodoWbsLinked persists TODO activity row")
    void recordTodoWbsLinked_persistsActivity() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var owner = createUser(7L, "tester", "김개발");
        final var todo = createTodo(500L, project, owner);

        when(projectTodoRepository.findByProjectAndId(project, 500L)).thenReturn(Optional.of(todo));

        workItemHistoryService.recordTodoWbsLinked(project, 500L, 100L, "백엔드 API", "tester");

        verify(workActivityRepository).save(any(WorkActivity.class));
    }

    private User createUser(Long id, String loginId, String name) {
        final var user = User.builder().loginId(loginId).password("encoded").name(name).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Team createTeam(Long id) {
        final var owner = createUser(1L, "owner", "Owner");
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private Project createProject(Long id, Team team) {
        final var project = Project.builder().name("Project").description("desc").team(team).build();
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }

    private WbsItem createWbsItem(Long id, Project project) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(null)
            .name("WBS")
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

    private ProjectTodo createTodo(Long id, Project project, User owner) {
        final var todo = ProjectTodo.builder()
            .project(project)
            .owner(owner)
            .linkedWbsItem(null)
            .status(ProjectTodoStatus.TODO)
            .priority(ProjectTodoPriority.MEDIUM)
            .title("TODO")
            .description("desc")
            .targetDate(null)
            .progressRate(0)
            .build();
        ReflectionTestUtils.setField(todo, "id", id);
        return todo;
    }
}
