package com.smarterd.domain.pm.milestone.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.entity.MilestoneType;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepositoryCustom.MilestoneProgressAggregate;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class MilestoneServiceTest {

    @Mock
    private MilestoneRepository milestoneRepository;

    @Mock
    private WbsDependencyRepository wbsDependencyRepository;

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Spy
    private Clock clock = Clock.fixed(Instant.parse("2026-04-15T00:00:00Z"), ZoneOffset.UTC);

    @InjectMocks
    private MilestoneService milestoneService;

    @Test
    @DisplayName("getMilestones - 연결 WBS 진척률 평균과 지연 여부를 계산한다")
    void getMilestones_calculatesAchievementAndDelay() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);

        final var delayed = createMilestone(100L, project, "요구사항 확정", LocalDate.parse("2026-04-14"), 0);
        final var onTrack = createMilestone(101L, project, "개발 완료", LocalDate.parse("2026-04-22"), 1);
        final var unplanned = createWbsItem(201L, project, "선행 분석", null, 30);
        final var linkedDelayed = createWbsItem(202L, project, "승인 준비", delayed, 60);
        final var linkedOnTrack = createWbsItem(203L, project, "릴리즈 정리", onTrack, 100);

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(milestoneRepository.findByProjectOrderBySortOrder(project)).thenReturn(List.of(delayed, onTrack));
        when(wbsDependencyRepository.findByProjectWithRelations(project)).thenReturn(
            List.of(
                createDependency(301L, project, unplanned, linkedDelayed),
                createDependency(302L, project, linkedDelayed, linkedOnTrack),
                createDependency(303L, project, linkedDelayed, createWbsItem(204L, project, "내부 확인", delayed, 90))
            )
        );
        when(wbsItemRepository.aggregateProgressByMilestone(project)).thenReturn(
            Map.of(100L, new MilestoneProgressAggregate(2, 1, 75), 101L, new MilestoneProgressAggregate(1, 1, 100))
        );

        final var result = milestoneService.getMilestones("tester", 10L, 20L);

        assertThat(result).hasSize(2);
        assertThat(result.getFirst().id()).isEqualTo(100L);
        assertThat(result.getFirst().type()).isEqualTo(MilestoneType.DELIVERABLE);
        assertThat(result.getFirst().achievementRate()).isEqualTo(75);
        assertThat(result.getFirst().linkedWbsItemCount()).isEqualTo(2);
        assertThat(result.getFirst().linkedWbsCompletedCount()).isEqualTo(1);
        assertThat(result.getFirst().nextWaveWbsCount()).isEqualTo(2);
        assertThat(result.getFirst().isDelayed()).isTrue();
        assertThat(result.getFirst().inboundDependencyCount()).isEqualTo(1);
        assertThat(result.getFirst().outboundDependencyCount()).isEqualTo(1);

        assertThat(result.get(1).id()).isEqualTo(101L);
        assertThat(result.get(1).achievementRate()).isEqualTo(100);
        assertThat(result.get(1).linkedWbsItemCount()).isEqualTo(1);
        assertThat(result.get(1).linkedWbsCompletedCount()).isEqualTo(1);
        assertThat(result.get(1).nextWaveWbsCount()).isZero();
        assertThat(result.get(1).inboundDependencyCount()).isEqualTo(1);
        assertThat(result.get(1).outboundDependencyCount()).isZero();
        assertThat(result.get(1).isDelayed()).isFalse();
    }

    @Test
    @DisplayName("deleteMilestone - 연결 WBS 참조를 제거하고 마일스톤을 삭제한다")
    void deleteMilestone_clearsReferencesAndDeletesMilestone() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var milestone = createMilestone(100L, project, "요구사항 확정", LocalDate.parse("2026-04-16"), 0);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(milestoneRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(milestone));

        milestoneService.deleteMilestone("tester", 10L, 20L, 100L);

        verify(wbsItemRepository).clearMilestoneReferences(milestone);
        verify(milestoneRepository).delete(milestone);
    }

    @Test
    @DisplayName("createMilestone - 프로젝트 내 다음 sortOrder로 생성한다")
    void createMilestone_usesNextSortOrder() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var ownerUser = createUser(7L, "owner", "Owner");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(milestoneRepository.findNextSortOrder(project)).thenReturn(4);
        when(milestoneRepository.save(any(Milestone.class))).thenAnswer((invocation) -> {
            final var saved = invocation.getArgument(0, Milestone.class);
            ReflectionTestUtils.setField(saved, "id", 555L);
            return saved;
        });
        when(userRepository.findById(7L)).thenReturn(Optional.of(ownerUser));
        when(teamMemberRepository.existsByTeamAndUser(team, ownerUser)).thenReturn(true);

        final var result = milestoneService.createMilestone(
            "tester",
            10L,
            20L,
            "테스트",
            LocalDate.parse("2026-05-31"),
            "desc",
            MilestoneType.APPROVAL,
            7L,
            "승인 대기"
        );

        assertThat(result.id()).isEqualTo(555L);
        assertThat(result.type()).isEqualTo(MilestoneType.APPROVAL);
        assertThat(result.ownerUserId()).isEqualTo(7L);
        assertThat(result.ownerName()).isEqualTo("Owner");
        assertThat(result.readinessNote()).isEqualTo("승인 대기");
        assertThat(result.sortOrder()).isEqualTo(4);
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

    private WbsItem createWbsItem(Long id, Project project, String name, Milestone milestone, int progressRate) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(null)
            .name(name)
            .depth(0)
            .sortOrder(0)
            .assignee(null)
            .startDate(null)
            .endDate(null)
            .progressRate(progressRate)
            .estimatedMm(null)
            .milestone(milestone)
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
