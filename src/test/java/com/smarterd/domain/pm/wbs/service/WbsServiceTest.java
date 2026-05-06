package com.smarterd.domain.pm.wbs.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.entity.MilestoneType;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WbsServiceTest {

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private MilestoneRepository milestoneRepository;

    @Mock
    private WbsDependencyRepository wbsDependencyRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WbsScheduleMetricsService wbsScheduleMetricsService;

    @InjectMocks
    private WbsService wbsService;

    @BeforeEach
    void setUp() {
        lenient()
            .when(wbsScheduleMetricsService.calculate(any(), any(), any(), any(), anyInt()))
            .thenReturn(new WbsScheduleMetricsService.WbsScheduleMetricsResult(null, null, null, null));
    }

    @Test
    @DisplayName("createWbsItem - 부모/담당자/마일스톤을 반영해 생성한다")
    void createWbsItem_withParentAndMilestone_createsItem() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var assignee = createUser(2L, "member", "Member");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var parent = createWbsItem(100L, project, null, "상위", 1, 0, null, null);
        final var milestone = createMilestone(300L, project, "M1", LocalDate.now().plusDays(2), 0);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(parent));
        when(wbsItemRepository.findNextSortOrder(project, parent)).thenReturn(3);
        when(userRepository.findById(2L)).thenReturn(Optional.of(assignee));
        when(teamMemberRepository.existsByTeamAndUser(team, assignee)).thenReturn(true);
        when(milestoneRepository.findByProjectAndId(project, 300L)).thenReturn(Optional.of(milestone));
        when(wbsItemRepository.save(any(WbsItem.class))).thenAnswer((invocation) -> {
            final var item = invocation.getArgument(0, WbsItem.class);
            ReflectionTestUtils.setField(item, "id", 500L);
            return item;
        });

        final var command = new WbsService.CreateWbsItemCommand(
            100L,
            "요구사항 분석",
            2L,
            LocalDate.parse("2026-04-20"),
            LocalDate.parse("2026-04-30"),
            LocalDate.parse("2026-04-22"),
            null,
            40,
            new BigDecimal("1.50"),
            300L
        );
        final var result = wbsService.createWbsItem("tester", 10L, 20L, command);

        assertThat(result.id()).isEqualTo(500L);
        assertThat(result.parentId()).isEqualTo(100L);
        assertThat(result.depth()).isEqualTo(2);
        assertThat(result.sortOrder()).isEqualTo(3);
        assertThat(result.assigneeUserId()).isEqualTo(2L);
        assertThat(result.milestoneId()).isEqualTo(300L);
        assertThat(result.actualStartDate()).isEqualTo(LocalDate.parse("2026-04-22"));
        verify(wbsItemRepository).save(any(WbsItem.class));
    }

    @Test
    @DisplayName("createWbsItem - 4단계 중첩 부모 아래에도 생성할 수 있다")
    void createWbsItem_withDeepParent_createsItemWithinRaisedDepthLimit() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var parent = createWbsItem(104L, project, null, "깊은 부모", 4, 0, null, null);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 104L)).thenReturn(Optional.of(parent));
        when(wbsItemRepository.findNextSortOrder(project, parent)).thenReturn(0);
        when(wbsItemRepository.save(any(WbsItem.class))).thenAnswer((invocation) -> {
            final var item = invocation.getArgument(0, WbsItem.class);
            ReflectionTestUtils.setField(item, "id", 501L);
            return item;
        });

        final var command = new WbsService.CreateWbsItemCommand(
            104L,
            "심화 화면 정의",
            null,
            LocalDate.parse("2026-04-28"),
            LocalDate.parse("2026-04-30"),
            null,
            null,
            0,
            new BigDecimal("0.50"),
            null
        );

        final var result = wbsService.createWbsItem("tester", 10L, 20L, command);

        assertThat(result.id()).isEqualTo(501L);
        assertThat(result.parentId()).isEqualTo(104L);
        assertThat(result.depth()).isEqualTo(5);
        verify(wbsItemRepository).save(any(WbsItem.class));
    }

    @Test
    @DisplayName("reorderWbsItems - 순환 부모 참조가 생기면 예외를 던진다")
    void reorderWbsItems_whenCycleCreated_throwsBusinessException() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var root = createWbsItem(100L, project, null, "루트", 0, 0, null, null);
        final var child = createWbsItem(101L, project, root, "자식", 1, 0, null, null);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectWithRelations(project)).thenReturn(List.of(root, child));

        assertThatThrownBy(() ->
            wbsService.reorderWbsItems("tester", 10L, 20L, List.of(new WbsService.WbsReorderCommand(100L, 101L, 0)))
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
    }

    @Test
    @DisplayName("getWbsItems - 트리 순서(전위 순회)로 반환한다")
    void getWbsItems_returnsPreOrderTree() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);

        final var rootA = createWbsItem(100L, project, null, "A", 0, 1, null, null);
        final var rootB = createWbsItem(101L, project, null, "B", 0, 0, null, null);
        final var childB1 = createWbsItem(102L, project, rootB, "B-1", 1, 0, null, null);

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectWithRelations(project)).thenReturn(List.of(rootA, childB1, rootB));
        when(wbsDependencyRepository.findByProjectWithRelations(project)).thenReturn(List.of());

        final var result = wbsService.getWbsItems("tester", 10L, 20L);

        assertThat(result).extracting(WbsService.WbsItemResult::id).containsExactly(101L, 102L, 100L);
    }

    private User createUser(Long id, String loginId, String name) {
        final var user = User.builder().loginId(loginId).password("hashed").name(name).build();
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

    private Milestone createMilestone(Long id, Project project, String name, LocalDate targetDate, int sortOrder) {
        final var milestone = Milestone.builder()
            .project(project)
            .name(name)
            .targetDate(targetDate)
            .description(null)
            .type(MilestoneType.DELIVERABLE)
            .owner(null)
            .readinessNote(null)
            .sortOrder(sortOrder)
            .build();
        ReflectionTestUtils.setField(milestone, "id", id);
        return milestone;
    }

    private WbsItem createWbsItem(
        Long id,
        Project project,
        WbsItem parent,
        String name,
        int depth,
        int sortOrder,
        User assignee,
        Milestone milestone
    ) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(parent)
            .name(name)
            .depth(depth)
            .sortOrder(sortOrder)
            .assignee(assignee)
            .startDate(null)
            .endDate(null)
            .progressRate(0)
            .estimatedMm(null)
            .milestone(milestone)
            .build();
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }
}
