package com.smarterd.domain.pm.milestone.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepositoryCustom.MilestoneProgressAggregate;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
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
    private WbsItemRepository wbsItemRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

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

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(milestoneRepository.findByProjectOrderBySortOrder(project)).thenReturn(List.of(delayed, onTrack));
        when(wbsItemRepository.aggregateProgressByMilestone(project)).thenReturn(
            Map.of(100L, new MilestoneProgressAggregate(2, 75))
        );

        final var result = milestoneService.getMilestones("tester", 10L, 20L);

        assertThat(result).hasSize(2);
        assertThat(result.getFirst().id()).isEqualTo(100L);
        assertThat(result.getFirst().achievementRate()).isEqualTo(75);
        assertThat(result.getFirst().linkedWbsItemCount()).isEqualTo(2);
        assertThat(result.getFirst().isDelayed()).isTrue();

        assertThat(result.get(1).id()).isEqualTo(101L);
        assertThat(result.get(1).achievementRate()).isEqualTo(0);
        assertThat(result.get(1).linkedWbsItemCount()).isEqualTo(0);
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
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(milestoneRepository.findNextSortOrder(project)).thenReturn(4);
        when(milestoneRepository.save(any(Milestone.class))).thenAnswer((invocation) -> {
            final var saved = invocation.getArgument(0, Milestone.class);
            ReflectionTestUtils.setField(saved, "id", 555L);
            return saved;
        });

        final var result = milestoneService.createMilestone(
            "tester",
            10L,
            20L,
            "테스트",
            LocalDate.parse("2026-05-31"),
            "desc"
        );

        assertThat(result.id()).isEqualTo(555L);
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
            .sortOrder(sortOrder)
            .build();
        ReflectionTestUtils.setField(milestone, "id", id);
        return milestone;
    }
}
