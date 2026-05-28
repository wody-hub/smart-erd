package com.smarterd.domain.pm.todo.service;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.todo.repository.TodoDocumentLinkRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 개인 TODO CRUD 및 WBS/문서 연결 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectTodoService {

    private final ProjectTodoAccessService projectTodoAccessService;
    private final ProjectTodoRepository projectTodoRepository;
    private final TodoDocumentLinkRepository todoDocumentLinkRepository;
    private final ProjectTodoMapper projectTodoMapper;
    private final ProjectTodoDocumentService projectTodoDocumentService;
    private final ProjectTodoWbsService projectTodoWbsService;
    private final WorkItemHistoryService workItemHistoryService;

    public List<ProjectTodoResult> getProjectTodos(String loginId, Long teamId, Long projectId) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var owner = projectTodoAccessService.findUserByLoginId(loginId);
        return projectTodoRepository
            .findByProjectAndOwnerOrderByCreatedAtDescIdDesc(project, owner)
            .stream()
            .map(projectTodoMapper::toProjectTodoResult)
            .toList();
    }

    public ProjectTodoResult getProjectTodo(String loginId, Long teamId, Long projectId, Long todoId) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        return projectTodoMapper.toProjectTodoResult(todo);
    }

    @Transactional
    public ProjectTodoResult createProjectTodo(
        String loginId,
        Long teamId,
        Long projectId,
        CreateProjectTodoCommand command
    ) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var owner = projectTodoAccessService.findUserByLoginId(loginId);
        final var linkedWbsItem = projectTodoAccessService.resolveWbsItem(project, command.linkedWbsItemId());
        final var todo = projectTodoRepository.save(
            ProjectTodo.builder()
                .project(project)
                .owner(owner)
                .linkedWbsItem(linkedWbsItem)
                .status(command.status() == null ? ProjectTodoStatus.TODO : command.status())
                .priority(command.priority() == null ? ProjectTodoPriority.MEDIUM : command.priority())
                .title(command.title())
                .description(command.description())
                .targetDate(command.targetDate())
                .progressRate(command.progressRate() == null ? 0 : command.progressRate())
                .build()
        );
        if (linkedWbsItem != null) {
            workItemHistoryService.recordTodoWbsLinked(project, todo.getId(), linkedWbsItem.getId(), linkedWbsItem.getName(), loginId);
        }
        return projectTodoMapper.toProjectTodoResult(todo);
    }

    @Transactional
    public ProjectTodoResult updateProjectTodo(
        String loginId,
        Long teamId,
        Long projectId,
        Long todoId,
        UpdateProjectTodoCommand command
    ) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        todo.update(
            command.title(),
            command.description(),
            command.status(),
            command.priority(),
            command.targetDate(),
            command.progressRate()
        );
        return projectTodoMapper.toProjectTodoResult(todo);
    }

    @Transactional
    public void deleteProjectTodo(String loginId, Long teamId, Long projectId, Long todoId) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        todoDocumentLinkRepository.deleteByTodo(todo);
        projectTodoRepository.delete(todo);
    }

    public List<TodoDocumentResult> getTodoDocuments(String loginId, Long teamId, Long projectId, Long todoId) {
        return projectTodoDocumentService.getTodoDocuments(loginId, teamId, projectId, todoId);
    }

    @Transactional
    public TodoDocumentResult linkDocument(
        String loginId,
        Long teamId,
        Long projectId,
        Long todoId,
        Long documentId,
        TodoDocumentVisibility visibility
    ) {
        return projectTodoDocumentService.linkDocument(loginId, teamId, projectId, todoId, documentId, visibility);
    }

    @Transactional
    public void unlinkDocument(String loginId, Long teamId, Long projectId, Long todoId, Long documentId) {
        projectTodoDocumentService.unlinkDocument(loginId, teamId, projectId, todoId, documentId);
    }

    @Transactional
    public ProjectTodoResult linkTodoToWbs(String loginId, Long teamId, Long projectId, Long todoId, Long wbsItemId) {
        return projectTodoWbsService.linkTodoToWbs(loginId, teamId, projectId, todoId, wbsItemId);
    }

    @Transactional
    public ProjectTodoResult unlinkTodoFromWbs(String loginId, Long teamId, Long projectId, Long todoId) {
        return projectTodoWbsService.unlinkTodoFromWbs(loginId, teamId, projectId, todoId);
    }

    public List<SharedTodoSummaryResult> getSharedTodoSummariesByWbs(String loginId, Long teamId, Long projectId, Long wbsItemId) {
        return projectTodoWbsService.getSharedTodoSummariesByWbs(loginId, teamId, projectId, wbsItemId);
    }

    public record CreateProjectTodoCommand(
        String title,
        @Nullable String description,
        @Nullable ProjectTodoStatus status,
        @Nullable ProjectTodoPriority priority,
        @Nullable LocalDate targetDate,
        @Nullable Integer progressRate,
        @Nullable Long linkedWbsItemId
    ) {}

    public record UpdateProjectTodoCommand(
        String title,
        @Nullable String description,
        ProjectTodoStatus status,
        ProjectTodoPriority priority,
        @Nullable LocalDate targetDate,
        int progressRate
    ) {}

    public record ProjectTodoResult(
        Long id,
        String title,
        @Nullable String description,
        ProjectTodoStatus status,
        ProjectTodoPriority priority,
        @Nullable LocalDate targetDate,
        int progressRate,
        @Nullable Long linkedWbsItemId,
        @Nullable String linkedWbsItemName,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record TodoDocumentResult(
        Long todoId,
        Long id,
        String name,
        String pluginId,
        @Nullable String templateKey,
        @Nullable String templateLabel,
        @Nullable String summaryText,
        List<String> tags,
        TodoDocumentVisibility visibility,
        @Nullable Instant linkedAt,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record SharedTodoSummaryResult(
        Long id,
        String title,
        ProjectTodoStatus status,
        ProjectTodoPriority priority,
        @Nullable LocalDate targetDate,
        int progressRate,
        Long ownerUserId,
        String ownerName,
        List<TodoDocumentResult> sharedDocuments
    ) {}
}
