package com.smarterd.domain.pm.wbs.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.entity.WbsTemplate;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsTemplateRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WbsPlanningServiceTest {

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private WbsDependencyRepository wbsDependencyRepository;

    @Mock
    private WbsTemplateRepository wbsTemplateRepository;

    @Mock
    private com.smarterd.domain.pm.milestone.repository.MilestoneRepository milestoneRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WbsScheduleMetricsService wbsScheduleMetricsService;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private WbsPlanningService wbsPlanningService;

    @BeforeEach
    void setUp() {
        wbsPlanningService = new WbsPlanningService(
            wbsItemRepository,
            wbsDependencyRepository,
            wbsTemplateRepository,
            milestoneRepository,
            projectContextLoader,
            teamMemberRepository,
            userRepository,
            objectMapper,
            wbsScheduleMetricsService
        );
        lenient()
            .when(wbsScheduleMetricsService.calculate(any(), any(), any(), any(), anyInt()))
            .thenReturn(new WbsScheduleMetricsService.WbsScheduleMetricsResult(null, null, null, null));
    }

    @Test
    @DisplayName("duplicateSubtree - 일정/진척률/담당자를 초기화하며 subtree를 복제한다")
    void duplicateSubtree_resetsOptionalFields() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);
        final var root = createWbsItem(100L, project, null, "루트", 0, 0);
        final var child = createWbsItem(101L, project, root, "자식", 1, 0);
        ReflectionTestUtils.setField(root, "startDate", LocalDate.parse("2026-05-10"));
        ReflectionTestUtils.setField(root, "endDate", LocalDate.parse("2026-05-12"));
        ReflectionTestUtils.setField(root, "progressRate", 50);
        ReflectionTestUtils.setField(child, "startDate", LocalDate.parse("2026-05-13"));
        ReflectionTestUtils.setField(child, "endDate", LocalDate.parse("2026-05-15"));
        ReflectionTestUtils.setField(child, "progressRate", 30);
        final var dependency = createDependency(201L, project, root, child);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectWithRelations(project)).thenReturn(List.of(root, child));
        when(wbsDependencyRepository.findByProjectWithRelations(project)).thenReturn(List.of(dependency));
        when(wbsItemRepository.findNextSortOrder(project, null)).thenReturn(0, 1);
        when(wbsDependencyRepository.findNextSortOrder(project)).thenReturn(0);
        when(wbsItemRepository.save(any(WbsItem.class))).thenAnswer((invocation) -> {
            final var item = invocation.getArgument(0, WbsItem.class);
            final var id = "루트".equals(item.getName()) ? 300L : 301L;
            ReflectionTestUtils.setField(item, "id", id);
            return item;
        });
        when(wbsDependencyRepository.save(any(WbsDependency.class))).thenAnswer((invocation) -> {
            final var saved = invocation.getArgument(0, WbsDependency.class);
            ReflectionTestUtils.setField(saved, "id", 401L);
            return saved;
        });

        final var result = wbsPlanningService.duplicateSubtree(
            "tester",
            10L,
            20L,
            100L,
            new WbsPlanningService.DuplicateSubtreeCommand(null, true, true, true, true, true)
        );

        assertThat(result.rootItemId()).isEqualTo(300L);
        assertThat(result.items()).hasSize(2);
        assertThat(result.items().get(0).progressRate()).isZero();
        assertThat(result.items().get(0).startDate()).isNull();
        assertThat(result.dependencies()).hasSize(1);
    }

    @Test
    @DisplayName("bulkCreate - 부모 clientKey 순환이 있으면 예외를 던진다")
    void bulkCreate_whenParentCycle_throwsBusinessException() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));

        assertThatThrownBy(() ->
            wbsPlanningService.bulkCreate(
                "tester",
                10L,
                20L,
                new WbsPlanningService.BulkCreateCommand(
                    List.of(
                        new WbsPlanningService.BulkCreateItemCommand(
                            "a",
                            null,
                            "b",
                            "A",
                            null,
                            null,
                            null,
                            0,
                            null,
                            null
                        ),
                        new WbsPlanningService.BulkCreateItemCommand(
                            "b",
                            null,
                            "a",
                            "B",
                            null,
                            null,
                            null,
                            0,
                            null,
                            null
                        )
                    )
                )
            )
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
    }

    @Test
    @DisplayName("saveTemplate + instantiateTemplate - stable payload를 저장하고 다시 적용한다")
    void saveTemplateAndInstantiate_roundTrip() {
        final var owner = createUser(1L, "tester");
        final var team = createTeam(10L, owner);
        final var project = createProject(20L, team);
        final var root = createWbsItem(100L, project, null, "운영 wave", 0, 0);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectWithRelations(project)).thenReturn(List.of(root));
        when(wbsDependencyRepository.findByProjectWithRelations(project)).thenReturn(List.of());
        when(wbsTemplateRepository.save(any(WbsTemplate.class))).thenAnswer((invocation) -> {
            final var template = invocation.getArgument(0, WbsTemplate.class);
            ReflectionTestUtils.setField(template, "id", 51L);
            return template;
        });
        when(wbsTemplateRepository.findByProjectAndId(project, 51L)).thenAnswer((ignored) -> {
            final var saved = WbsTemplate.builder()
                .project(project)
                .name("운영 템플릿")
                .description("설명")
                .rootName("운영 wave")
                .itemCount(1)
                .dependencyCount(0)
                .payloadJson(
                    objectMapper.writeValueAsString(
                        new WbsPlanningService.TemplatePayload(
                            "운영 wave",
                            List.of(
                                new WbsPlanningService.TemplateNodePayload(
                                    "node-1",
                                    null,
                                    "운영 wave",
                                    null,
                                    null,
                                    null,
                                    0,
                                    new BigDecimal("1.00"),
                                    null,
                                    0
                                )
                            ),
                            List.of()
                        )
                    )
                )
                .build();
            ReflectionTestUtils.setField(saved, "id", 51L);
            return Optional.of(saved);
        });
        when(wbsItemRepository.findNextSortOrder(project, null)).thenReturn(0);
        when(wbsItemRepository.save(any(WbsItem.class))).thenAnswer((invocation) -> {
            final var item = invocation.getArgument(0, WbsItem.class);
            ReflectionTestUtils.setField(item, "id", 500L);
            return item;
        });

        final var savedTemplate = wbsPlanningService.saveTemplate(
            "tester",
            10L,
            20L,
            new WbsPlanningService.SaveTemplateCommand(100L, "운영 템플릿", "설명")
        );
        final var instantiated = wbsPlanningService.instantiateTemplate(
            "tester",
            10L,
            20L,
            savedTemplate.id(),
            new WbsPlanningService.InstantiateTemplateCommand(null, true, false, true, true, false)
        );

        assertThat(savedTemplate.id()).isEqualTo(51L);
        assertThat(instantiated.items())
            .singleElement()
            .satisfies((item) -> assertThat(item.id()).isEqualTo(500L));
        verify(wbsTemplateRepository).save(any(WbsTemplate.class));
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

    private WbsItem createWbsItem(Long id, Project project, WbsItem parent, String name, int depth, int sortOrder) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(parent)
            .name(name)
            .depth(depth)
            .sortOrder(sortOrder)
            .assignee(null)
            .startDate(null)
            .endDate(null)
            .progressRate(0)
            .estimatedMm(new BigDecimal("1.00"))
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
