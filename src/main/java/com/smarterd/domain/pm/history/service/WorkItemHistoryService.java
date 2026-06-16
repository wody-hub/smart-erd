package com.smarterd.domain.pm.history.service;

import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.history.entity.WorkActivity;
import com.smarterd.domain.pm.history.entity.WorkActivityEventType;
import com.smarterd.domain.pm.history.entity.WorkActivitySubjectType;
import com.smarterd.domain.pm.history.entity.WorkComment;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.pm.history.repository.WorkActivityRepository;
import com.smarterd.domain.pm.history.repository.WorkCommentRepository;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.repository.ProjectIssueRepository;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공통 작업 댓글/활동 로그 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkItemHistoryService {

    private final ProjectContextLoader projectContextLoader;
    private final WbsItemRepository wbsItemRepository;
    private final ProjectIssueRepository projectIssueRepository;
    private final ProjectTodoRepository projectTodoRepository;
    private final WorkCommentRepository workCommentRepository;
    private final WorkActivityRepository workActivityRepository;
    private final UserRepository userRepository;

    public List<WorkCommentResult> getWbsComments(String loginId, Long teamId, Long projectId, Long wbsItemId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        ensureTargetExists(context.project(), WorkTargetType.WBS, wbsItemId);
        final var comments = workCommentRepository.findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtAscIdAsc(
            context.project(),
            WorkTargetType.WBS,
            wbsItemId
        );
        final var actorNames = resolveActorNames(comments.stream().map(WorkComment::getCreatedBy).toList());
        return comments
            .stream()
            .map((comment) -> toCommentResult(comment, actorNames))
            .toList();
    }

    /**
     * Adds a user-authored comment to a WBS item.
     *
     * @param loginId actor login ID
     * @param teamId team ID
     * @param projectId project ID
     * @param wbsItemId WBS item ID
     * @param content comment body
     * @return saved comment result
     */
    @Transactional
    public WorkCommentResult addWbsComment(
        String loginId,
        Long teamId,
        Long projectId,
        Long wbsItemId,
        String content
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        ensureTargetExists(context.project(), WorkTargetType.WBS, wbsItemId);

        final var comment = WorkComment.builder()
            .project(context.project())
            .targetType(WorkTargetType.WBS)
            .targetId(wbsItemId)
            .content(content)
            .build();
        comment.initializeAuditActor(loginId);
        final var saved = workCommentRepository.save(comment);
        final var actorNames = resolveActorNames(List.of(saved.getCreatedBy()));
        return toCommentResult(saved, actorNames);
    }

    public List<WorkActivityResult> getWbsActivities(String loginId, Long teamId, Long projectId, Long wbsItemId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        ensureTargetExists(context.project(), WorkTargetType.WBS, wbsItemId);
        final var activities = workActivityRepository.findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtDescIdDesc(
            context.project(),
            WorkTargetType.WBS,
            wbsItemId
        );
        final var actorNames = resolveActorNames(activities.stream().map(WorkActivity::getCreatedBy).toList());
        return activities
            .stream()
            .map((activity) -> toActivityResult(activity, actorNames))
            .toList();
    }

    /**
     * Records that a document was linked to a WBS item.
     *
     * @param project target project
     * @param wbsItemId WBS item ID
     * @param documentId linked document ID
     * @param documentName linked document name
     * @param actorLoginId actor login ID
     */
    @Transactional
    public void recordWbsDocumentLinked(
        Project project,
        Long wbsItemId,
        Long documentId,
        String documentName,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.WBS, wbsItemId);
        saveActivity(
            project,
            WorkTargetType.WBS,
            wbsItemId,
            WorkActivityEventType.DOCUMENT_LINKED,
            WorkActivitySubjectType.DOCUMENT,
            documentId,
            documentName,
            null,
            null,
            "Linked document to WBS item",
            actorLoginId
        );
    }

    /**
     * Records that a document was unlinked from a WBS item.
     *
     * @param project target project
     * @param wbsItemId WBS item ID
     * @param documentId unlinked document ID
     * @param documentName unlinked document name
     * @param actorLoginId actor login ID
     */
    @Transactional
    public void recordWbsDocumentUnlinked(
        Project project,
        Long wbsItemId,
        Long documentId,
        String documentName,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.WBS, wbsItemId);
        saveActivity(
            project,
            WorkTargetType.WBS,
            wbsItemId,
            WorkActivityEventType.DOCUMENT_UNLINKED,
            WorkActivitySubjectType.DOCUMENT,
            documentId,
            documentName,
            null,
            null,
            "Unlinked document from WBS item",
            actorLoginId
        );
    }

    @Transactional
    public void recordProjectIssueStatusChanged(
        Project project,
        Long issueId,
        ProjectIssueStatus previousStatus,
        ProjectIssueStatus currentStatus,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.ISSUE, issueId);
        saveActivity(
            project,
            WorkTargetType.ISSUE,
            issueId,
            WorkActivityEventType.ISSUE_STATUS_CHANGED,
            WorkActivitySubjectType.STATUS,
            null,
            null,
            previousStatus.name(),
            currentStatus.name(),
            "Advanced project issue status",
            actorLoginId
        );
    }

    /**
     * Records that a document was linked to a TODO item.
     *
     * @param project target project
     * @param todoId TODO item ID
     * @param documentId linked document ID
     * @param documentName linked document name
     * @param actorLoginId actor login ID
     */
    @Transactional
    public void recordTodoDocumentLinked(
        Project project,
        Long todoId,
        Long documentId,
        String documentName,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.TODO, todoId);
        saveActivity(
            project,
            WorkTargetType.TODO,
            todoId,
            WorkActivityEventType.DOCUMENT_LINKED,
            WorkActivitySubjectType.DOCUMENT,
            documentId,
            documentName,
            null,
            null,
            "Linked document to TODO",
            actorLoginId
        );
    }

    /**
     * Records that a document was unlinked from a TODO item.
     *
     * @param project target project
     * @param todoId TODO item ID
     * @param documentId unlinked document ID
     * @param documentName unlinked document name
     * @param actorLoginId actor login ID
     */
    @Transactional
    public void recordTodoDocumentUnlinked(
        Project project,
        Long todoId,
        Long documentId,
        String documentName,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.TODO, todoId);
        saveActivity(
            project,
            WorkTargetType.TODO,
            todoId,
            WorkActivityEventType.DOCUMENT_UNLINKED,
            WorkActivitySubjectType.DOCUMENT,
            documentId,
            documentName,
            null,
            null,
            "Unlinked document from TODO",
            actorLoginId
        );
    }

    /**
     * Records that a TODO item was linked to a WBS item.
     *
     * @param project target project
     * @param todoId TODO item ID
     * @param wbsItemId linked WBS item ID
     * @param wbsItemName linked WBS item name
     * @param actorLoginId actor login ID
     */
    @Transactional
    public void recordTodoWbsLinked(
        Project project,
        Long todoId,
        Long wbsItemId,
        String wbsItemName,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.TODO, todoId);
        saveActivity(
            project,
            WorkTargetType.TODO,
            todoId,
            WorkActivityEventType.TODO_WBS_LINKED,
            WorkActivitySubjectType.WBS,
            wbsItemId,
            wbsItemName,
            null,
            null,
            "Linked TODO to WBS item",
            actorLoginId
        );
    }

    /**
     * Records that a TODO item was unlinked from a WBS item.
     *
     * @param project target project
     * @param todoId TODO item ID
     * @param wbsItemId unlinked WBS item ID
     * @param wbsItemName unlinked WBS item name
     * @param actorLoginId actor login ID
     */
    @Transactional
    public void recordTodoWbsUnlinked(
        Project project,
        Long todoId,
        Long wbsItemId,
        String wbsItemName,
        String actorLoginId
    ) {
        ensureTargetExists(project, WorkTargetType.TODO, todoId);
        saveActivity(
            project,
            WorkTargetType.TODO,
            todoId,
            WorkActivityEventType.TODO_WBS_UNLINKED,
            WorkActivitySubjectType.WBS,
            wbsItemId,
            wbsItemName,
            null,
            null,
            "Unlinked TODO from WBS item",
            actorLoginId
        );
    }

    private void saveActivity(
        Project project,
        WorkTargetType targetType,
        Long targetId,
        WorkActivityEventType eventType,
        @Nullable WorkActivitySubjectType subjectType,
        @Nullable Long subjectId,
        @Nullable String subjectLabel,
        @Nullable String previousValue,
        @Nullable String currentValue,
        @Nullable String detail,
        String actorLoginId
    ) {
        final var activity = WorkActivity.builder()
            .project(project)
            .targetType(targetType)
            .targetId(targetId)
            .eventType(eventType)
            .subjectType(subjectType)
            .subjectId(subjectId)
            .subjectLabel(subjectLabel)
            .previousValue(previousValue)
            .currentValue(currentValue)
            .detail(detail)
            .build();
        activity.initializeAuditActor(actorLoginId);
        workActivityRepository.save(activity);
    }

    private void ensureTargetExists(Project project, WorkTargetType targetType, Long targetId) {
        Objects.requireNonNull(targetId);
        switch (targetType) {
            case WBS -> wbsItemRepository
                .findByProjectAndId(project, targetId)
                .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), targetId));
            case ISSUE -> projectIssueRepository
                .findByProjectAndId(project, targetId)
                .orElseThrow(() ->
                    new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_ISSUE.code(), targetId)
                );
            case TODO -> projectTodoRepository
                .findByProjectAndId(project, targetId)
                .orElseThrow(() ->
                    new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_TODO.code(), targetId)
                );
        }
    }

    private WorkCommentResult toCommentResult(WorkComment comment, Map<String, String> actorNames) {
        return new WorkCommentResult(
            comment.getId(),
            comment.getTargetType(),
            comment.getTargetId(),
            comment.getContent(),
            comment.getCreatedBy(),
            actorNames.get(comment.getCreatedBy()),
            comment.getCreatedAt(),
            comment.getUpdatedAt()
        );
    }

    private WorkActivityResult toActivityResult(WorkActivity activity, Map<String, String> actorNames) {
        return new WorkActivityResult(
            activity.getId(),
            activity.getTargetType(),
            activity.getTargetId(),
            activity.getEventType(),
            activity.getSubjectType(),
            activity.getSubjectId(),
            activity.getSubjectLabel(),
            activity.getPreviousValue(),
            activity.getCurrentValue(),
            activity.getDetail(),
            activity.getCreatedBy(),
            actorNames.get(activity.getCreatedBy()),
            activity.getCreatedAt()
        );
    }

    private Map<String, String> resolveActorNames(Collection<String> loginIds) {
        final var normalized = loginIds.stream().filter(Objects::nonNull).distinct().toList();
        if (normalized.isEmpty()) {
            return Map.of();
        }
        return userRepository
            .findByLoginIdIn(normalized)
            .stream()
            .collect(Collectors.toMap((user) -> user.getLoginId(), (user) -> user.getName(), (left, right) -> left));
    }

    public record WorkCommentResult(
        Long id,
        WorkTargetType targetType,
        Long targetId,
        String content,
        @Nullable String actorLoginId,
        @Nullable String actorName,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record WorkActivityResult(
        Long id,
        WorkTargetType targetType,
        Long targetId,
        WorkActivityEventType eventType,
        @Nullable WorkActivitySubjectType subjectType,
        @Nullable Long subjectId,
        @Nullable String subjectLabel,
        @Nullable String previousValue,
        @Nullable String currentValue,
        @Nullable String detail,
        @Nullable String actorLoginId,
        @Nullable String actorName,
        Instant occurredAt
    ) {}
}
