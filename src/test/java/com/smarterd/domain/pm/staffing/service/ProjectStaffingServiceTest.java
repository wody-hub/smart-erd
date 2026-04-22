package com.smarterd.domain.pm.staffing.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.staffing.entity.ProjectStaffing;
import com.smarterd.domain.pm.staffing.entity.StaffingGrade;
import com.smarterd.domain.pm.staffing.repository.ProjectStaffingRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectStaffingServiceTest {

    @Mock
    private ProjectStaffingRepository projectStaffingRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Spy
    private StaffingAllocationCalculator staffingAllocationCalculator = new StaffingAllocationCalculator();

    @InjectMocks
    private ProjectStaffingService projectStaffingService;

    @Test
    @DisplayName("getProjectStaffing uses read context and returns deterministic summary/months")
    void getProjectStaffing_usesReadContextAndBuildsSummary() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var memberA = createUser(2L, "kim", "Kim");
        final var memberB = createUser(3L, "lee", "Lee");

        final var staffingA = createStaffing(
            100L,
            project,
            memberA,
            StaffingGrade.MIDDLE,
            10_000_000L,
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            100,
            null,
            null,
            null
        );
        final var staffingB = createStaffing(
            101L,
            project,
            memberB,
            StaffingGrade.SENIOR,
            10_000_000L,
            LocalDate.parse("2026-04-16"),
            LocalDate.parse("2026-05-15"),
            100,
            LocalDate.parse("2026-04-16"),
            LocalDate.parse("2026-04-30"),
            100
        );

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(projectStaffingRepository.findByProject(project)).thenReturn(List.of(staffingB, staffingA));

        final var result = projectStaffingService.getProjectStaffing("tester", 10L, 20L);

        verify(projectContextLoader).load("tester", 10L, 20L, false);
        assertThat(result.resources()).hasSize(2);
        assertThat(result.resources()).extracting(ProjectStaffingService.ProjectStaffingResourceResult::memberName).containsExactly(
            "Kim",
            "Lee"
        );
        assertThat(result.summary().plannedMm()).isEqualByComparingTo("1.98");
        assertThat(result.summary().actualMm()).isEqualByComparingTo("0.50");
        assertThat(result.summary().deltaMm()).isEqualByComparingTo("-1.48");
        assertThat(result.summary().plannedCost()).isEqualTo(19_800_000L);
        assertThat(result.summary().actualCost()).isEqualTo(5_000_000L);
        assertThat(result.months()).containsExactly("2026-04", "2026-05");
    }

    @Test
    @DisplayName("createProjectStaffing uses editable context and validates current team membership")
    void createProjectStaffing_usesEditableContextAndMembershipValidation() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var member = createUser(7L, "member", "Member");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(userRepository.findById(7L)).thenReturn(Optional.of(member));
        when(teamMemberRepository.existsByTeamAndUser(team, member)).thenReturn(true);
        when(projectStaffingRepository.existsByProjectAndUser(project, member)).thenReturn(false);
        when(projectStaffingRepository.save(any(ProjectStaffing.class))).thenAnswer((invocation) -> {
            final var saved = invocation.getArgument(0, ProjectStaffing.class);
            ReflectionTestUtils.setField(saved, "id", 500L);
            ReflectionTestUtils.setField(saved, "createdAt", Instant.parse("2026-04-22T00:00:00Z"));
            ReflectionTestUtils.setField(saved, "updatedAt", Instant.parse("2026-04-22T00:00:00Z"));
            return saved;
        });

        final var result = projectStaffingService.createProjectStaffing(
            "tester",
            10L,
            20L,
            new ProjectStaffingService.CreateProjectStaffingCommand(
                7L,
                StaffingGrade.MIDDLE,
                12_000_000L,
                LocalDate.parse("2026-04-01"),
                LocalDate.parse("2026-04-30"),
                100,
                null,
                null,
                null
            )
        );

        verify(projectContextLoader).load("tester", 10L, 20L, true);
        verify(teamMemberRepository).existsByTeamAndUser(team, member);
        assertThat(result.id()).isEqualTo(500L);
        assertThat(result.userId()).isEqualTo(7L);
        assertThat(result.memberName()).isEqualTo("Member");
    }

    @Test
    @DisplayName("createProjectStaffing throws duplicate when same project member already exists")
    void createProjectStaffing_duplicatePreCheck_throwsDuplicateException() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var member = createUser(7L, "member", "Member");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(userRepository.findById(7L)).thenReturn(Optional.of(member));
        when(teamMemberRepository.existsByTeamAndUser(team, member)).thenReturn(true);
        when(projectStaffingRepository.existsByProjectAndUser(project, member)).thenReturn(true);

        assertThatThrownBy(() ->
            projectStaffingService.createProjectStaffing(
                "tester",
                10L,
                20L,
                new ProjectStaffingService.CreateProjectStaffingCommand(
                    7L,
                    StaffingGrade.MIDDLE,
                    10_000_000L,
                    LocalDate.parse("2026-04-01"),
                    LocalDate.parse("2026-04-30"),
                    100,
                    null,
                    null,
                    null
                )
            )
        )
            .isInstanceOf(DuplicateException.class)
            .hasMessage(MessageCode.ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER.code());
    }

    @Test
    @DisplayName("createProjectStaffing maps DB unique race to duplicate exception")
    void createProjectStaffing_uniqueRace_mapsToDuplicateException() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var member = createUser(7L, "member", "Member");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(userRepository.findById(7L)).thenReturn(Optional.of(member));
        when(teamMemberRepository.existsByTeamAndUser(team, member)).thenReturn(true);
        when(projectStaffingRepository.existsByProjectAndUser(project, member)).thenReturn(false);
        when(projectStaffingRepository.save(any(ProjectStaffing.class))).thenThrow(
            new DataIntegrityViolationException("constraint [uk_project_staffing_project_user] violated")
        );

        assertThatThrownBy(() ->
            projectStaffingService.createProjectStaffing(
                "tester",
                10L,
                20L,
                new ProjectStaffingService.CreateProjectStaffingCommand(
                    7L,
                    StaffingGrade.MIDDLE,
                    10_000_000L,
                    LocalDate.parse("2026-04-01"),
                    LocalDate.parse("2026-04-30"),
                    100,
                    null,
                    null,
                    null
                )
            )
        )
            .isInstanceOf(DuplicateException.class)
            .hasMessage(MessageCode.ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER.code());
    }

    @Test
    @DisplayName("createProjectStaffing rejects users outside current team membership")
    void createProjectStaffing_nonTeamMember_throwsAccessDenied() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var outsider = createUser(99L, "outsider", "Outsider");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(userRepository.findById(99L)).thenReturn(Optional.of(outsider));
        when(teamMemberRepository.existsByTeamAndUser(team, outsider)).thenReturn(false);

        assertThatThrownBy(() ->
            projectStaffingService.createProjectStaffing(
                "tester",
                10L,
                20L,
                new ProjectStaffingService.CreateProjectStaffingCommand(
                    99L,
                    StaffingGrade.JUNIOR,
                    9_000_000L,
                    LocalDate.parse("2026-04-01"),
                    LocalDate.parse("2026-04-30"),
                    100,
                    null,
                    null,
                    null
                )
            )
        )
            .isInstanceOf(DomainAccessDeniedException.class)
            .hasMessage(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
    }

    @Test
    @DisplayName("updateProjectStaffing keeps member locked and updates staffing fields")
    void updateProjectStaffing_updatesFieldsButKeepsMember() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var member = createUser(7L, "member", "Member");
        final var staffing = createStaffing(
            100L,
            project,
            member,
            StaffingGrade.JUNIOR,
            8_000_000L,
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            80,
            null,
            null,
            null
        );

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectStaffingRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(staffing));

        final var result = projectStaffingService.updateProjectStaffing(
            "tester",
            10L,
            20L,
            100L,
            new ProjectStaffingService.UpdateProjectStaffingCommand(
                StaffingGrade.EXPERT,
                15_000_000L,
                LocalDate.parse("2026-04-01"),
                LocalDate.parse("2026-05-31"),
                100,
                LocalDate.parse("2026-04-05"),
                LocalDate.parse("2026-05-25"),
                90
            )
        );

        assertThat(result.userId()).isEqualTo(7L);
        assertThat(result.grade()).isEqualTo(StaffingGrade.EXPERT);
        assertThat(result.monthlyRate()).isEqualTo(15_000_000L);
        assertThat(result.actualParticipationRate()).isEqualTo(90);
    }

    @Test
    @DisplayName("deleteProjectStaffing rejects unknown staffing row")
    void deleteProjectStaffing_unknownRow_throwsNotFound() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectStaffingRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectStaffingService.deleteProjectStaffing("tester", 10L, 20L, 100L))
            .isInstanceOf(EntityNotFoundException.class)
            .hasMessage(MessageCode.ERROR_NOT_FOUND_PROJECT_STAFFING.code());
    }

    @Test
    @DisplayName("existing staffing rows remain listable even after team membership removal")
    void getProjectStaffing_doesNotRecheckMembershipForExistingRows() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var removedMember = createUser(7L, "removed", "Removed Member");
        final var staffing = createStaffing(
            100L,
            project,
            removedMember,
            StaffingGrade.MIDDLE,
            10_000_000L,
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            100,
            null,
            null,
            null
        );

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(projectStaffingRepository.findByProject(project)).thenReturn(List.of(staffing));

        final var result = projectStaffingService.getProjectStaffing("tester", 10L, 20L);

        assertThat(result.resources()).hasSize(1);
        assertThat(result.resources().getFirst().memberName()).isEqualTo("Removed Member");
        verifyNoInteractions(teamMemberRepository);
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

    private ProjectStaffing createStaffing(
        Long id,
        Project project,
        User user,
        StaffingGrade grade,
        long monthlyRate,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        int plannedParticipationRate,
        LocalDate actualStartDate,
        LocalDate actualEndDate,
        Integer actualParticipationRate
    ) {
        final var staffing = ProjectStaffing.builder()
            .project(project)
            .user(user)
            .grade(grade)
            .monthlyRate(monthlyRate)
            .plannedStartDate(plannedStartDate)
            .plannedEndDate(plannedEndDate)
            .plannedParticipationRate(plannedParticipationRate)
            .actualStartDate(actualStartDate)
            .actualEndDate(actualEndDate)
            .actualParticipationRate(actualParticipationRate)
            .build();
        ReflectionTestUtils.setField(staffing, "id", id);
        ReflectionTestUtils.setField(staffing, "createdAt", Instant.parse("2026-04-22T00:00:00Z"));
        ReflectionTestUtils.setField(staffing, "updatedAt", Instant.parse("2026-04-22T00:00:00Z"));
        return staffing;
    }
}
