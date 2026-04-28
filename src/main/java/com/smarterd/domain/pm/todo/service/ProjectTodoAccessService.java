package com.smarterd.domain.pm.todo.service;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class ProjectTodoAccessService {

    private final ProjectContextLoader projectContextLoader;
    private final ProjectTodoRepository projectTodoRepository;
    private final WbsItemRepository wbsItemRepository;
    private final DiagramRepository diagramRepository;
    private final UserRepository userRepository;

    Project loadProject(String loginId, Long teamId, Long projectId) {
        return projectContextLoader.load(loginId, teamId, projectId, false).project();
    }

    User findUserByLoginId(String loginId) {
        return userRepository
            .findByLoginId(loginId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), loginId));
    }

    ProjectTodo findOwnedTodo(String loginId, Project project, Long todoId) {
        final var todo = projectTodoRepository
            .findByProjectAndId(project, Objects.requireNonNull(todoId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_TODO.code(), todoId));
        ensureOwner(todo, loginId);
        return todo;
    }

    WbsItem findWbsItem(Project project, Long wbsItemId) {
        return wbsItemRepository
            .findByProjectAndId(project, Objects.requireNonNull(wbsItemId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), wbsItemId));
    }

    @Nullable
    WbsItem resolveWbsItem(Project project, @Nullable Long wbsItemId) {
        if (wbsItemId == null) {
            return null;
        }
        return findWbsItem(project, wbsItemId);
    }

    Diagram findDocument(Project project, Long documentId) {
        return diagramRepository
            .findByProjectAndIdAndDeletedAtIsNull(project, documentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), documentId));
    }

    private void ensureOwner(ProjectTodo todo, String loginId) {
        if (!Objects.equals(todo.getOwner().getLoginId(), loginId)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY.code());
        }
    }
}
