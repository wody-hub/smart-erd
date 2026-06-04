package com.smarterd.domain.pm.issue.service;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
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
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 프로젝트 이슈 CRUD/필터/내보내기 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectIssueService {

    private final ProjectIssueRepository projectIssueRepository;
    private final ProjectContextLoader projectContextLoader;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final WorkItemHistoryService workItemHistoryService;

    /**
     * 프로젝트 이슈 목록을 조회한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param query 서버 소유 필터
     * @return 프로젝트 이슈 목록
     */
    public List<ProjectIssueResult> getProjectIssues(
        String loginId,
        Long teamId,
        Long projectId,
        @Nullable ProjectIssueQuery query
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        return projectIssueRepository
            .findByProjectAndQuery(context.project(), ProjectIssueQuery.normalize(query))
            .stream()
            .map(this::toResult)
            .toList();
    }

    /**
     * 프로젝트 이슈 단건을 조회한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @return 프로젝트 이슈
     */
    public ProjectIssueResult getProjectIssue(String loginId, Long teamId, Long projectId, Long issueId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        return toResult(findByProjectAndId(context.project(), issueId));
    }

    /**
     * 프로젝트 이슈를 생성한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param command 생성 커맨드
     * @return 생성된 이슈
     */
    @Transactional
    public ProjectIssueResult createProjectIssue(
        String loginId,
        Long teamId,
        Long projectId,
        CreateProjectIssueCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var assignee = resolveAssigneeForCreate(context.team(), command.assigneeUserId());

        final var issue = Objects.requireNonNull(
            ProjectIssue.builder()
                .project(context.project())
                .assignee(assignee)
                .status(ProjectIssueStatus.REGISTERED)
                .priority(command.priority() == null ? ProjectIssuePriority.MEDIUM : command.priority())
                .title(command.title())
                .description(command.description())
                .build()
        );
        projectIssueRepository.save(issue);
        return toResult(issue);
    }

    /**
     * 프로젝트 이슈를 수정한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @param command 수정 커맨드
     * @return 수정된 이슈
     */
    @Transactional
    public ProjectIssueResult updateProjectIssue(
        String loginId,
        Long teamId,
        Long projectId,
        Long issueId,
        UpdateProjectIssueCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var issue = findByProjectAndId(context.project(), issueId);
        final var assignee = resolveAssigneeForUpdate(context.team(), issue, command.assigneeUserId());

        issue.update(command.title(), command.description(), command.priority(), assignee);
        return toResult(issue);
    }

    /**
     * 프로젝트 이슈 상태를 다음 단계로 전진시킨다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @return 갱신된 이슈
     */
    @Transactional
    public ProjectIssueResult advanceProjectIssueStatus(String loginId, Long teamId, Long projectId, Long issueId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var issue = findByProjectAndId(context.project(), issueId);
        final var previousStatus = issue.getStatus();
        issue.advanceStatus();
        workItemHistoryService.recordProjectIssueStatusChanged(
            context.project(),
            issueId,
            previousStatus,
            issue.getStatus(),
            loginId
        );
        return toResult(issue);
    }

    /**
     * 프로젝트 이슈 상태를 명시된 다음 단계로 갱신한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param issueId 이슈 ID
     * @param status 요청 상태
     * @return 갱신된 이슈
     */
    @Transactional
    public ProjectIssueResult updateProjectIssueStatus(
        String loginId,
        Long teamId,
        Long projectId,
        Long issueId,
        ProjectIssueStatus status
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var issue = findByProjectAndId(context.project(), issueId);
        final var nextStatus = issue.getStatus().next();
        if (nextStatus == null || nextStatus != status) {
            throw new ConflictException(MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_STATUS_TRANSITION_INVALID.code());
        }
        final var previousStatus = issue.getStatus();
        issue.advanceStatus();
        workItemHistoryService.recordProjectIssueStatusChanged(
            context.project(),
            issueId,
            previousStatus,
            issue.getStatus(),
            loginId
        );
        return toResult(issue);
    }

    /**
     * 현재 필터 조건의 프로젝트 이슈 워크북을 생성한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param query 서버 소유 필터
     * @return 엑셀 데이터
     */
    public ExcelData exportProjectIssues(String loginId, Long teamId, Long projectId, @Nullable ProjectIssueQuery query) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        final var issues = projectIssueRepository.findByProjectAndQuery(context.project(), ProjectIssueQuery.normalize(query));
        final var template = ProjectIssueWorkbookExportSupport.createTemplate(
            AppStringUtils.defaultIfBlank(context.project().getName(), "project") + " 이슈 목록"
        );

        var rowIndex = 2;
        for (final var issue : issues) {
            final var row = template.sheet().createRow(rowIndex++);
            ProjectIssueWorkbookExportSupport.writeTextCell(row, 0, issue.getStatus().name(), template.bodyStyle());
            ProjectIssueWorkbookExportSupport.writeTextCell(row, 1, issue.getPriority().name(), template.bodyStyle());
            ProjectIssueWorkbookExportSupport.writeTextCell(row, 2, issue.getTitle(), template.bodyStyle());
            ProjectIssueWorkbookExportSupport.writeTextCell(
                row,
                3,
                issue.getAssignee() == null ? "" : issue.getAssignee().getName(),
                template.bodyStyle()
            );
            ProjectIssueWorkbookExportSupport.writeTextCell(row, 4, issue.getDescription(), template.bodyStyle());
            ProjectIssueWorkbookExportSupport.writeInstantCell(row, 5, issue.getCreatedAt(), template.bodyStyle());
            ProjectIssueWorkbookExportSupport.writeInstantCell(row, 6, issue.getUpdatedAt(), template.bodyStyle());
        }

        return new ExcelData(
            template.workbook(),
            AppStringUtils.defaultIfBlank(context.project().getName(), "project") + "-issues"
        );
    }

    /**
     * 프로젝트 범위에서 이슈를 조회한다.
     *
     * @param project 프로젝트 엔티티
     * @param issueId 이슈 ID
     * @return 프로젝트 이슈
     */
    private ProjectIssue findByProjectAndId(Project project, Long issueId) {
        return projectIssueRepository
            .findByProjectAndId(project, Objects.requireNonNull(issueId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_ISSUE.code(), issueId));
    }

    /**
     * 생성 시점 담당자를 현재 팀 멤버 기준으로 검증한다.
     *
     * @param team 팀 엔티티
     * @param assigneeUserId 담당자 사용자 ID
     * @return 검증된 담당자 또는 {@code null}
     */
    @Nullable
    private User resolveAssigneeForCreate(Team team, @Nullable Long assigneeUserId) {
        if (assigneeUserId == null) {
            return null;
        }
        return resolveCurrentTeamMember(team, assigneeUserId);
    }

    /**
     * 수정 시점 담당자를 검증하되, 기존 담당자를 그대로 유지하는 경우는 허용한다.
     *
     * @param team 팀 엔티티
     * @param issue 현재 프로젝트 이슈
     * @param assigneeUserId 요청 담당자 사용자 ID
     * @return 검증된 담당자 또는 {@code null}
     */
    @Nullable
    private User resolveAssigneeForUpdate(Team team, ProjectIssue issue, @Nullable Long assigneeUserId) {
        if (assigneeUserId == null) {
            return null;
        }
        if (issue.getAssignee() != null && Objects.equals(issue.getAssignee().getId(), assigneeUserId)) {
            return issue.getAssignee();
        }
        return resolveCurrentTeamMember(team, assigneeUserId);
    }

    /**
     * 현재 팀 멤버인 사용자를 조회한다.
     *
     * @param team 팀 엔티티
     * @param assigneeUserId 담당자 사용자 ID
     * @return 현재 팀 멤버 사용자
     */
    private User resolveCurrentTeamMember(Team team, Long assigneeUserId) {
        final var user = userRepository
            .findById(Objects.requireNonNull(assigneeUserId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), assigneeUserId));

        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
        }
        return user;
    }

    /**
     * 엔티티를 API 친화적인 결과 레코드로 변환한다.
     *
     * @param issue 프로젝트 이슈 엔티티
     * @return 서비스 결과 레코드
     */
    private ProjectIssueResult toResult(ProjectIssue issue) {
        final var assignee = issue.getAssignee();
        return new ProjectIssueResult(
            issue.getId(),
            issue.getTitle(),
            issue.getDescription(),
            issue.getPriority(),
            issue.getStatus(),
            assignee == null ? null : assignee.getId(),
            assignee == null ? null : assignee.getLoginId(),
            assignee == null ? null : assignee.getName(),
            issue.getCreatedAt(),
            issue.getUpdatedAt()
        );
    }

    /**
     * 프로젝트 이슈 생성 커맨드.
     *
     * @param title 제목
     * @param description 내용
     * @param priority 우선순위
     * @param assigneeUserId 담당자 사용자 ID
     */
    public record CreateProjectIssueCommand(
        String title,
        @Nullable String description,
        @Nullable ProjectIssuePriority priority,
        @Nullable Long assigneeUserId
    ) {}

    /**
     * 프로젝트 이슈 수정 커맨드.
     *
     * @param title 제목
     * @param description 내용
     * @param priority 우선순위
     * @param assigneeUserId 담당자 사용자 ID
     */
    public record UpdateProjectIssueCommand(
        String title,
        @Nullable String description,
        ProjectIssuePriority priority,
        @Nullable Long assigneeUserId
    ) {}

    /**
     * 프로젝트 이슈 조회 필터.
     *
     * @param statuses 상태 필터
     * @param priorities 우선순위 필터
     * @param assigneeIds 담당자 사용자 ID 필터
     * @param includeUnassigned 미배정 포함 여부
     */
    public record ProjectIssueQuery(
        List<ProjectIssueStatus> statuses,
        List<ProjectIssuePriority> priorities,
        List<Long> assigneeIds,
        boolean includeUnassigned
    ) {
        /**
         * 입력 필터를 정규화한다.
         *
         * @param query 원본 필터
         * @return null-safe, dedupe 완료 필터
         */
        public static ProjectIssueQuery normalize(@Nullable ProjectIssueQuery query) {
            return query == null ? new ProjectIssueQuery(List.of(), List.of(), List.of(), false) : query;
        }

        public ProjectIssueQuery {
            statuses = statuses == null ? List.of() : List.copyOf(new LinkedHashSet<>(statuses));
            priorities = priorities == null ? List.of() : List.copyOf(new LinkedHashSet<>(priorities));
            assigneeIds = assigneeIds == null ? List.of() : List.copyOf(new LinkedHashSet<>(assigneeIds));
        }
    }

    /**
     * 프로젝트 이슈 응답 결과.
     *
     * @param id 이슈 ID
     * @param title 제목
     * @param description 내용
     * @param priority 우선순위
     * @param status 상태
     * @param assigneeUserId 담당자 사용자 ID
     * @param assigneeLoginId 담당자 로그인 ID
     * @param assigneeName 담당자 이름
     * @param createdAt 생성 시각
     * @param updatedAt 수정 시각
     */
    public record ProjectIssueResult(
        Long id,
        String title,
        @Nullable String description,
        ProjectIssuePriority priority,
        ProjectIssueStatus status,
        @Nullable Long assigneeUserId,
        @Nullable String assigneeLoginId,
        @Nullable String assigneeName,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
