package com.smarterd.domain.pm.wbs.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
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
class WbsDependencyServiceTest {

    @Mock
    private WbsDependencyRepository wbsDependencyRepository;

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

    @InjectMocks
    private WbsDependencyService wbsDependencyService;

    @Test
    @DisplayName("createDependency - 선후행 관계를 생성한다")
    void createDependency_createsDependency() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);
        final var predecessor = createWbsItem(100L, project, "요구사항 분석");
        final var successor = createWbsItem(101L, project, "화면 설계");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(predecessor));
        when(wbsItemRepository.findByProjectAndId(project, 101L)).thenReturn(Optional.of(successor));
        when(
            wbsDependencyRepository.existsByProjectAndPredecessorAndSuccessorAndDependencyType(
                project,
                predecessor,
                successor,
                WbsDependencyType.FS
            )
        ).thenReturn(false);
        when(wbsDependencyRepository.findByProjectWithRelations(project)).thenReturn(List.of());
        when(wbsDependencyRepository.findNextSortOrder(project)).thenReturn(0);
        when(wbsDependencyRepository.save(any(WbsDependency.class))).thenAnswer((invocation) -> {
            final var dependency = invocation.getArgument(0, WbsDependency.class);
            ReflectionTestUtils.setField(dependency, "id", 500L);
            return dependency;
        });

        final var result = wbsDependencyService.createDependency(
            "tester",
            10L,
            20L,
            new WbsDependencyService.WbsDependencyCommand(100L, 101L, WbsDependencyType.FS)
        );

        assertThat(result.id()).isEqualTo(500L);
        assertThat(result.predecessorWbsItemId()).isEqualTo(100L);
        assertThat(result.successorWbsItemId()).isEqualTo(101L);
        assertThat(result.dependencyType()).isEqualTo(WbsDependencyType.FS);
        verify(wbsDependencyRepository).save(any(WbsDependency.class));
    }

    @Test
    @DisplayName("createDependency - 자기 자신을 연결하면 예외를 던진다")
    void createDependency_whenSelfReference_throwsBusinessException() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);
        final var item = createWbsItem(100L, project, "요구사항 분석");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() ->
            wbsDependencyService.createDependency(
                "tester",
                10L,
                20L,
                new WbsDependencyService.WbsDependencyCommand(100L, 100L, WbsDependencyType.FS)
            )
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_WBS_DEPENDENCY_SELF_REFERENCE.code());
    }

    @Test
    @DisplayName("createDependency - 중복 dependency 생성이 차단된다")
    void createDependency_whenDuplicate_throwsDuplicateException() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);
        final var predecessor = createWbsItem(100L, project, "요구사항 분석");
        final var successor = createWbsItem(101L, project, "화면 설계");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(predecessor));
        when(wbsItemRepository.findByProjectAndId(project, 101L)).thenReturn(Optional.of(successor));
        when(
            wbsDependencyRepository.existsByProjectAndPredecessorAndSuccessorAndDependencyType(
                project,
                predecessor,
                successor,
                WbsDependencyType.FS
            )
        ).thenReturn(true);

        assertThatThrownBy(() ->
            wbsDependencyService.createDependency(
                "tester",
                10L,
                20L,
                new WbsDependencyService.WbsDependencyCommand(100L, 101L, WbsDependencyType.FS)
            )
        )
            .isInstanceOf(DuplicateException.class)
            .hasMessage(MessageCode.ERROR_DUPLICATE_WBS_DEPENDENCY.code());
    }

    @Test
    @DisplayName("createDependency - 순환 경로를 만들면 예외를 던진다")
    void createDependency_whenCycleCreated_throwsBusinessException() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);
        final var itemA = createWbsItem(100L, project, "A");
        final var itemB = createWbsItem(101L, project, "B");
        final var itemC = createWbsItem(102L, project, "C");
        final var dependencyAB = createDependency(201L, project, itemA, itemB);
        final var dependencyBC = createDependency(202L, project, itemB, itemC);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 102L)).thenReturn(Optional.of(itemC));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(itemA));
        when(
            wbsDependencyRepository.existsByProjectAndPredecessorAndSuccessorAndDependencyType(
                project,
                itemC,
                itemA,
                WbsDependencyType.FS
            )
        ).thenReturn(false);
        when(wbsDependencyRepository.findByProjectWithRelations(project)).thenReturn(List.of(dependencyAB, dependencyBC));

        assertThatThrownBy(() ->
            wbsDependencyService.createDependency(
                "tester",
                10L,
                20L,
                new WbsDependencyService.WbsDependencyCommand(102L, 100L, WbsDependencyType.FS)
            )
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_WBS_DEPENDENCY_CYCLE.code());
    }

    private User createUser(Long id, String loginId) {
        final var user = User.builder().loginId(loginId).password("hashed").name(loginId).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Team createTeam(Long id, User owner) {
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private Project createProject(Long id, Team team) {
        final var project = Project.builder().name("Project").description("desc").team(team).build();
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }

    private WbsItem createWbsItem(Long id, Project project, String name) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(null)
            .name(name)
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

    private WbsDependency createDependency(Long id, Project project, WbsItem predecessor, WbsItem successor) {
        final var dependency = WbsDependency.builder()
            .project(project)
            .predecessor(predecessor)
            .successor(successor)
            .dependencyType(WbsDependencyType.FS)
            .sortOrder(0)
            .build();
        ReflectionTestUtils.setField(dependency, "id", id);
        return dependency;
    }
}
