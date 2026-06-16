package com.smarterd.domain.pm.todo.service;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.markdown.service.MarkdownDocumentDescriptorService;
import com.smarterd.domain.markdown.service.MarkdownTemplateDescriptor;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.TodoDocumentLink;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class ProjectTodoMapper {

    private final MarkdownDocumentDescriptorService markdownDocumentDescriptorService;

    ProjectTodoService.ProjectTodoResult toProjectTodoResult(ProjectTodo todo) {
        final var linkedWbsItem = todo.getLinkedWbsItem();
        return new ProjectTodoService.ProjectTodoResult(
            todo.getId(),
            todo.getTitle(),
            todo.getDescription(),
            todo.getStatus(),
            todo.getPriority(),
            todo.getTargetDate(),
            todo.getProgressRate(),
            linkedWbsItem == null ? null : linkedWbsItem.getId(),
            linkedWbsItem == null ? null : linkedWbsItem.getName(),
            todo.getCreatedAt(),
            todo.getUpdatedAt()
        );
    }

    ProjectTodoService.TodoDocumentResult toTodoDocumentResult(TodoDocumentLink link) {
        return toTodoDocumentResult(
            link.getTodo().getId(),
            link.getDiagram(),
            link.getVisibility(),
            link.getCreatedAt()
        );
    }

    ProjectTodoService.TodoDocumentResult toTodoDocumentResult(
        Long todoId,
        Diagram document,
        TodoDocumentVisibility visibility,
        @Nullable Instant linkedAt
    ) {
        final MarkdownTemplateDescriptor descriptor = document.isMarkdownDocument()
            ? markdownDocumentDescriptorService.describe(document.getContent())
            : new MarkdownTemplateDescriptor(document.getTemplateKey(), null, document.getSummaryText(), List.of());

        return new ProjectTodoService.TodoDocumentResult(
            todoId,
            document.getId(),
            document.getName(),
            document.getPluginId(),
            descriptor.templateKey(),
            descriptor.templateLabel(),
            descriptor.summaryText(),
            descriptor.tags(),
            visibility,
            linkedAt,
            document.getCreatedAt(),
            document.getUpdatedAt()
        );
    }
}
