package com.smarterd.domain.pm.todo.service;

import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.todo.entity.TodoDocumentLink;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import com.smarterd.domain.pm.todo.repository.TodoDocumentLinkRepository;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class ProjectTodoDocumentService {

    private final ProjectTodoAccessService projectTodoAccessService;
    private final TodoDocumentLinkRepository todoDocumentLinkRepository;
    private final ProjectTodoMapper projectTodoMapper;
    private final WorkItemHistoryService workItemHistoryService;

    public List<ProjectTodoService.TodoDocumentResult> getTodoDocuments(
        String loginId,
        Long teamId,
        Long projectId,
        Long todoId
    ) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        return todoDocumentLinkRepository
            .findByTodoOrderByCreatedAtDescIdDesc(todo)
            .stream()
            .map(projectTodoMapper::toTodoDocumentResult)
            .toList();
    }

    @Transactional
    public ProjectTodoService.TodoDocumentResult linkDocument(
        String loginId,
        Long teamId,
        Long projectId,
        Long todoId,
        Long documentId,
        TodoDocumentVisibility visibility
    ) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        final var document = projectTodoAccessService.findDocument(project, documentId);
        final var existing = todoDocumentLinkRepository.findByTodoAndDiagram(todo, document);
        if (existing.isPresent()) {
            existing.get().updateVisibility(visibility);
            return projectTodoMapper.toTodoDocumentResult(existing.get());
        }

        final var link = todoDocumentLinkRepository.save(
            TodoDocumentLink.builder().todo(todo).diagram(document).visibility(visibility).build()
        );
        workItemHistoryService.recordTodoDocumentLinked(project, todoId, document.getId(), document.getName(), loginId);
        return projectTodoMapper.toTodoDocumentResult(link);
    }

    @Transactional
    public void unlinkDocument(String loginId, Long teamId, Long projectId, Long todoId, Long documentId) {
        final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
        final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
        final var document = projectTodoAccessService.findDocument(project, documentId);
        final var existing = todoDocumentLinkRepository.findByTodoAndDiagram(todo, document);
        if (existing.isEmpty()) {
            return;
        }
        todoDocumentLinkRepository.deleteByTodoAndDiagram(todo, document);
        workItemHistoryService.recordTodoDocumentUnlinked(
            project,
            todoId,
            document.getId(),
            document.getName(),
            loginId
        );
    }
}
