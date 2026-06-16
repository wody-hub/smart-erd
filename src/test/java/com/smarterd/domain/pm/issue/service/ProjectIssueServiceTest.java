package com.smarterd.domain.pm.issue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.issue.entity.ProjectIssue;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.repository.ProjectIssueRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.apache.poi.ss.usermodel.CellType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectIssueServiceTest {

    @Mock
    private ProjectIssueRepository projectIssueRepository;

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkItemHistoryService workItemHistoryService;

    @InjectMocks
    private ProjectIssueService projectIssueService;

    @Test
    @DisplayName("getProjectIssues uses read context and maps repository rows")
    void getProjectIssues_usesReadContextAndMapsRows() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var assignee = createUser(7L, "kim", "김개발");
        final var issue = createIssue(
            100L,
            project,
            assignee,
            ProjectIssueStatus.REGISTERED,
            ProjectIssuePriority.HIGH,
            "API 응답 정렬 규칙 보완",
            "정렬 우선순위를 서버에서 고정한다."
        );

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(
            projectIssueRepository.findByProjectAndQuery(
                project,
                new ProjectIssueService.ProjectIssueQuery(
                    List.of(ProjectIssueStatus.REGISTERED),
                    List.of(ProjectIssuePriority.HIGH),
                    List.of(7L),
                    true
                )
            )
        ).thenReturn(List.of(issue));

        final var result = projectIssueService.getProjectIssues(
            "tester",
            10L,
            20L,
            new ProjectIssueService.ProjectIssueQuery(
                List.of(ProjectIssueStatus.REGISTERED),
                List.of(ProjectIssuePriority.HIGH),
                List.of(7L),
                true
            )
        );

        verify(projectContextLoader).load("tester", 10L, 20L, false);
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().assigneeName()).isEqualTo("김개발");
        assertThat(result.getFirst().status()).isEqualTo(ProjectIssueStatus.REGISTERED);
    }

    @Test
    @DisplayName("createProjectIssue uses editable context and defaults priority to medium")
    void createProjectIssue_defaultsPriorityAndValidatesAssignee() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var assignee = createUser(7L, "kim", "김개발");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(userRepository.findById(7L)).thenReturn(Optional.of(assignee));
        when(teamMemberRepository.existsByTeamAndUser(team, assignee)).thenReturn(true);
        when(projectIssueRepository.save(any(ProjectIssue.class))).thenAnswer((invocation) -> {
            final var saved = invocation.getArgument(0, ProjectIssue.class);
            ReflectionTestUtils.setField(saved, "id", 500L);
            ReflectionTestUtils.setField(saved, "createdAt", Instant.parse("2026-04-23T00:00:00Z"));
            ReflectionTestUtils.setField(saved, "updatedAt", Instant.parse("2026-04-23T00:00:00Z"));
            return saved;
        });

        final var result = projectIssueService.createProjectIssue(
            "tester",
            10L,
            20L,
            new ProjectIssueService.CreateProjectIssueCommand("권한 예외 응답 정리", "viewer write 차단 확인", null, 7L)
        );

        verify(projectContextLoader).load("tester", 10L, 20L, true);
        verify(teamMemberRepository).existsByTeamAndUser(team, assignee);
        assertThat(result.id()).isEqualTo(500L);
        assertThat(result.priority()).isEqualTo(ProjectIssuePriority.MEDIUM);
        assertThat(result.status()).isEqualTo(ProjectIssueStatus.REGISTERED);
        assertThat(result.assigneeUserId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("createProjectIssue rejects assignee outside current team membership")
    void createProjectIssue_nonMember_throwsAccessDenied() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var outsider = createUser(99L, "outsider", "외부인");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(userRepository.findById(99L)).thenReturn(Optional.of(outsider));
        when(teamMemberRepository.existsByTeamAndUser(team, outsider)).thenReturn(false);

        assertThatThrownBy(() ->
            projectIssueService.createProjectIssue(
                "tester",
                10L,
                20L,
                new ProjectIssueService.CreateProjectIssueCommand(
                    "외부 담당자 금지",
                    null,
                    ProjectIssuePriority.HIGH,
                    99L
                )
            )
        )
            .isInstanceOf(DomainAccessDeniedException.class)
            .hasMessage(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
    }

    @Test
    @DisplayName("updateProjectIssue preserves former assignee when request keeps same user")
    void updateProjectIssue_preservesFormerAssigneeWhenUnchanged() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var formerAssignee = createUser(7L, "kim", "김개발");
        final var issue = createIssue(
            100L,
            project,
            formerAssignee,
            ProjectIssueStatus.IN_PROGRESS,
            ProjectIssuePriority.MEDIUM,
            "기존 제목",
            "기존 내용"
        );

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectIssueRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(issue));

        final var result = projectIssueService.updateProjectIssue(
            "tester",
            10L,
            20L,
            100L,
            new ProjectIssueService.UpdateProjectIssueCommand(
                "수정된 제목",
                "수정된 내용",
                ProjectIssuePriority.HIGH,
                7L
            )
        );

        verify(projectContextLoader).load("tester", 10L, 20L, true);
        verifyNoInteractions(userRepository, teamMemberRepository);
        assertThat(result.title()).isEqualTo("수정된 제목");
        assertThat(result.assigneeUserId()).isEqualTo(7L);
        assertThat(result.priority()).isEqualTo(ProjectIssuePriority.HIGH);
    }

    @Test
    @DisplayName("advanceProjectIssueStatus rejects advancing a done issue")
    void advanceProjectIssueStatus_doneIssue_throwsConflict() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var issue = createIssue(
            100L,
            project,
            null,
            ProjectIssueStatus.DONE,
            ProjectIssuePriority.MEDIUM,
            "완료 이슈",
            null
        );

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectIssueRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(issue));

        assertThatThrownBy(() -> projectIssueService.advanceProjectIssueStatus("tester", 10L, 20L, 100L))
            .isInstanceOf(ConflictException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_STATUS_TRANSITION_INVALID.code());
    }

    @Test
    @DisplayName("advanceProjectIssueStatus records shared activity when status changes")
    void advanceProjectIssueStatus_recordsSharedActivity() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var issue = createIssue(
            100L,
            project,
            null,
            ProjectIssueStatus.REGISTERED,
            ProjectIssuePriority.MEDIUM,
            "등록 이슈",
            null
        );

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectIssueRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(issue));

        final var result = projectIssueService.advanceProjectIssueStatus("tester", 10L, 20L, 100L);

        verify(workItemHistoryService).recordProjectIssueStatusChanged(
            project,
            100L,
            ProjectIssueStatus.REGISTERED,
            ProjectIssueStatus.IN_PROGRESS,
            "tester"
        );
        assertThat(result.status()).isEqualTo(ProjectIssueStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("updateProjectIssueStatus rejects non-next transitions")
    void updateProjectIssueStatus_rejectsNonNextTransition() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var issue = createIssue(
            100L,
            project,
            null,
            ProjectIssueStatus.REGISTERED,
            ProjectIssuePriority.MEDIUM,
            "등록 이슈",
            null
        );

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectIssueRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(issue));

        assertThatThrownBy(() ->
            projectIssueService.updateProjectIssueStatus("tester", 10L, 20L, 100L, ProjectIssueStatus.DONE)
        )
            .isInstanceOf(ConflictException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_STATUS_TRANSITION_INVALID.code());
    }

    @Test
    @DisplayName("updateProjectIssueStatus records shared activity on valid next transition")
    void updateProjectIssueStatus_recordsSharedActivity() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        final var issue = createIssue(
            100L,
            project,
            null,
            ProjectIssueStatus.REGISTERED,
            ProjectIssuePriority.MEDIUM,
            "등록 이슈",
            null
        );

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(projectIssueRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(issue));

        final var result = projectIssueService.updateProjectIssueStatus(
            "tester",
            10L,
            20L,
            100L,
            ProjectIssueStatus.IN_PROGRESS
        );

        verify(workItemHistoryService).recordProjectIssueStatusChanged(
            project,
            100L,
            ProjectIssueStatus.REGISTERED,
            ProjectIssueStatus.IN_PROGRESS,
            "tester"
        );
        assertThat(result.status()).isEqualTo(ProjectIssueStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("exportProjectIssues builds workbook from filtered rows and writes plain string cells")
    void exportProjectIssues_buildsWorkbookWithStringCells() {
        final var loginUser = createUser(1L, "tester", "Tester");
        final var team = createTeam(10L, loginUser);
        final var project = createProject(20L, team);
        ReflectionTestUtils.setField(project, "name", "phoenix");
        final var assignee = createUser(7L, "kim", "김개발");
        final var issue = createIssue(
            100L,
            project,
            assignee,
            ProjectIssueStatus.REGISTERED,
            ProjectIssuePriority.CRITICAL,
            "=SUM(1,2)",
            "@review"
        );

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(
            projectIssueRepository.findByProjectAndQuery(
                project,
                new ProjectIssueService.ProjectIssueQuery(
                    List.of(ProjectIssueStatus.REGISTERED),
                    List.of(ProjectIssuePriority.CRITICAL),
                    List.of(),
                    true
                )
            )
        ).thenReturn(List.of(issue));

        final var excelData = projectIssueService.exportProjectIssues(
            "tester",
            10L,
            20L,
            new ProjectIssueService.ProjectIssueQuery(
                List.of(ProjectIssueStatus.REGISTERED),
                List.of(ProjectIssuePriority.CRITICAL),
                List.of(),
                true
            )
        );

        assertThat(excelData.fileName()).isEqualTo("phoenix-issues");
        final var sheet = excelData.excelBook().getSheetAt(0);
        final var row = sheet.getRow(2);
        assertThat(row.getCell(0).getStringCellValue()).isEqualTo("REGISTERED");
        assertThat(row.getCell(2).getCellType()).isEqualTo(CellType.STRING);
        assertThat(row.getCell(2).getStringCellValue()).isEqualTo("=SUM(1,2)");
        assertThat(row.getCell(4).getStringCellValue()).isEqualTo("@review");
    }

    private User createUser(Long id, String loginId, String name) {
        final var user = User.builder().loginId(loginId).password("encoded").name(name).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Team createTeam(Long id, User owner) {
        final var team = com.smarterd.domain.team.entity.Team.builder().name("Delivery").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private Project createProject(Long id, Team team) {
        final var project = Project.builder().name("Phoenix").description("phase 8").team(team).build();
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }

    private ProjectIssue createIssue(
        Long id,
        Project project,
        User assignee,
        ProjectIssueStatus status,
        ProjectIssuePriority priority,
        String title,
        String description
    ) {
        final var issue = ProjectIssue.builder()
            .project(project)
            .assignee(assignee)
            .status(status)
            .priority(priority)
            .title(title)
            .description(description)
            .build();
        ReflectionTestUtils.setField(issue, "id", id);
        ReflectionTestUtils.setField(issue, "createdAt", Instant.parse("2026-04-23T01:00:00Z"));
        ReflectionTestUtils.setField(issue, "updatedAt", Instant.parse("2026-04-23T02:00:00Z"));
        return issue;
    }
}
