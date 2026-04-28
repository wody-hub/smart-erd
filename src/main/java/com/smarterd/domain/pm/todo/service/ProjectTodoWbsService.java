package com.smarterd.domain.pm.todo.service;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.todo.repository.TodoDocumentLinkRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class ProjectTodoWbsService {

    private final ProjectTodoAccessService projectTodoAccessService;
    private final ProjectTodoRepository projectTodoRepository;
    private final TodoDocumentLinkRepository todoDocumentLinkRepository;
    private final ProjectTodoMapper projectTodoMapper;
    private final WorkItemHistoryService workItemHistoryService;

    @Transactional
    public ProjectTodoService.ProjectTodoResult linkTodoToWbs(
        String loginId,
        Long teamId,
        Long projectId,
        Long todoId,
        Long wbsItemId
    ) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        final var previousWbsItem = todo.getLinkedWbsItem();
        final var nextWbsItem = projectTodoAccessService.findWbsItem(project, wbsItemId);
        todo.linkToWbs(nextWbsItem);
        if (!Objects.equals(previousWbsItem == null ? null : previousWbsItem.getId(), nextWbsItem.getId())) {
            if (previousWbsItem != null) {
                workItemHistoryService.recordTodoWbsUnlinked(
                    project,
                    todoId,
                    previousWbsItem.getId(),
                    previousWbsItem.getName(),
                    loginId
                );
            }
            workItemHistoryService.recordTodoWbsLinked(project, todoId, nextWbsItem.getId(), nextWbsItem.getName(), loginId);
        }
        return projectTodoMapper.toProjectTodoResult(todo);
    }

    @Transactional
    public ProjectTodoService.ProjectTodoResult unlinkTodoFromWbs(String loginId, Long teamId, Long projectId, Long todoId) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        final var previousWbsItem = todo.getLinkedWbsItem();
        todo.linkToWbs(null);
        if (previousWbsItem != null) {
            workItemHistoryService.recordTodoWbsUnlinked(
                project,
                todoId,
                previousWbsItem.getId(),
                previousWbsItem.getName(),
                loginId
            );
        }
        return projectTodoMapper.toProjectTodoResult(todo);
    }

    public List<ProjectTodoService.SharedTodoSummaryResult> getSharedTodoSummariesByWbs(
        String loginId,
        Long teamId,
        Long projectId,
        Long wbsItemId
    ) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var wbsItem = projectTodoAccessService.findWbsItem(project, wbsItemId);
        final var todos = projectTodoRepository.findByProjectAndLinkedWbsItemOrderByCreatedAtDescIdDesc(project, wbsItem);
        if (todos.isEmpty()) {
            return List.of();
        }

        final var sharedDocumentsByTodoId = new LinkedHashMap<Long, List<ProjectTodoService.TodoDocumentResult>>();
        todoDocumentLinkRepository
            .findByTodoInAndVisibility(todos, TodoDocumentVisibility.PROJECT_SHARED)
            .stream()
            .map(projectTodoMapper::toTodoDocumentResult)
            .forEach((result) -> sharedDocumentsByTodoId.computeIfAbsent(result.todoId(), (key) -> new java.util.ArrayList<>()).add(result));

        return todos
            .stream()
            .map((todo) ->
                new ProjectTodoService.SharedTodoSummaryResult(
                    todo.getId(),
                    todo.getTitle(),
                    todo.getStatus(),
                    todo.getPriority(),
                    todo.getTargetDate(),
                    todo.getProgressRate(),
                    todo.getOwner().getId(),
                    todo.getOwner().getName(),
                    sharedDocumentsByTodoId.getOrDefault(todo.getId(), List.of())
                )
            )
            .toList();
    }
}
