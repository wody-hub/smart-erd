package com.smarterd.domain.pm.todo.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectTodoAccessServiceTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private ProjectTodoRepository projectTodoRepository;

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ProjectTodoAccessService projectTodoAccessService;

    @Test
    @DisplayName("findOwnedTodo rejects non-owner access")
    void findOwnedTodo_rejectsNonOwnerAccess() {
        final var owner = createUser(1L, "owner", "Owner");
        final var requester = createUser(2L, "tester", "김개발");
        final var project = createProject(20L, requester);
        final var todo = createTodo(301L, project, owner);

        when(projectTodoRepository.findByProjectAndId(project, 301L)).thenReturn(Optional.of(todo));

        assertThatThrownBy(() -> projectTodoAccessService.findOwnedTodo("tester", project, 301L))
            .isInstanceOf(DomainAccessDeniedException.class)
            .hasMessage(MessageCode.ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY.code());
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
