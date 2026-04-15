package com.smarterd.domain.project.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.repository.ProjectRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private ProjectProgressProvider projectProgressProvider;

    @Mock
    private AuthService authService;

    @Mock
    private TeamService teamService;

    @InjectMocks
    private ProjectService projectService;

    @Test
    @DisplayName("getBusinessOverview - WBS 평균 진척률을 progressRate로 반환한다")
    void getBusinessOverview_returnsProgressRateFromWbsAverage() {
        final var user = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, user);
        final var project = createProject(20L, team);

        when(authService.findUserByLoginId("tester")).thenReturn(user);
        when(teamService.findTeamById(10L)).thenReturn(team);
        when(projectRepository.findById(20L)).thenReturn(Optional.of(project));
        when(teamService.countMembers(team)).thenReturn(5L);
        when(diagramRepository.countByProjectAndDeletedAtIsNull(project)).thenReturn(12L);
        when(projectProgressProvider.getAverageProgressRate(project)).thenReturn(72);

        final var result = projectService.getBusinessOverview("tester", 10L, 20L);

        assertThat(result.memberCount()).isEqualTo(5L);
        assertThat(result.documentCount()).isEqualTo(12L);
        assertThat(result.progressRate()).isEqualTo(72);
        verify(teamService).verifyMembership(team, user);
        verify(projectProgressProvider).getAverageProgressRate(project);
    }

    @Test
    @DisplayName("updateBusinessOverview - WBS 항목이 없으면 progressRate는 null이다")
    void updateBusinessOverview_withoutWbsItems_returnsNullProgressRate() {
        final var user = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, user);
        final var project = createProject(20L, team);

        when(authService.findUserByLoginId("tester")).thenReturn(user);
        when(teamService.findTeamById(10L)).thenReturn(team);
        when(projectRepository.findById(20L)).thenReturn(Optional.of(project));
        when(teamService.countMembers(team)).thenReturn(3L);
        when(diagramRepository.countByProjectAndDeletedAtIsNull(project)).thenReturn(4L);
        when(projectProgressProvider.getAverageProgressRate(project)).thenReturn(null);

        final var result = projectService.updateBusinessOverview(
            "tester",
            10L,
            20L,
            "Client",
            "Contractor",
            1000L,
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-05-01"),
            "Scope"
        );

        assertThat(result.clientCompany()).isEqualTo("Client");
        assertThat(result.contractorCompany()).isEqualTo("Contractor");
        assertThat(result.contractAmount()).isEqualTo(1000L);
        assertThat(result.progressRate()).isNull();
        verify(teamService).verifyEditable(team, user);
        verify(projectProgressProvider).getAverageProgressRate(project);
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
}
