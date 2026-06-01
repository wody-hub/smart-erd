package com.smarterd.application.ai;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.pm.issue.repository.ProjectIssueRepository;
import com.smarterd.domain.pm.todo.repository.ProjectTodoRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Validates optional AI selected resource scope before prompt creation.
 */
@Component
@RequiredArgsConstructor
public class SelectedResourceValidator {

    private final ProjectIssueRepository projectIssueRepository;
    private final ProjectTodoRepository projectTodoRepository;
    private final WbsItemRepository wbsItemRepository;
    private final DiagramRepository diagramRepository;

    public void validate(String loginId, Project project, AiSelectedResource selectedResource) {
        if (selectedResource == null) {
            return;
        }
        final var id = Objects.requireNonNull(selectedResource.id());
        final var type = selectedResource.type() == null ? "" : selectedResource.type().toUpperCase(Locale.ROOT);
        switch (type) {
            case "PROJECT_ISSUE", "ISSUE" -> projectIssueRepository
                .findByProjectAndId(project, id)
                .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_ISSUE.code(), id));
            case "PROJECT_TODO", "TODO" -> {
                final var todo = projectTodoRepository
                    .findByProjectAndId(project, id)
                    .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_TODO.code(), id));
                if (!Objects.equals(todo.getOwner().getLoginId(), loginId)) {
                    throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY.code());
                }
            }
            case "WBS_ITEM", "WBS" -> wbsItemRepository
                .findByProjectAndId(project, id)
                .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), id));
            case "DOCUMENT", "DIAGRAM" -> diagramRepository
                .findByProjectAndIdAndDeletedAtIsNull(project, id)
                .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), id));
            default -> throw new BusinessException(
                MessageCode.ERROR_BUSINESS_AI_SELECTED_RESOURCE_UNSUPPORTED.code(),
                selectedResource.type()
            );
        }
    }
}
