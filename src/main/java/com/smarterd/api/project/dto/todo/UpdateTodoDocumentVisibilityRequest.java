package com.smarterd.api.project.dto.todo;

import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * TODO 문서 연결 공개 범위 요청 DTO.
 */
@Schema(description = "TODO 문서 연결 공개 범위 요청")
public record UpdateTodoDocumentVisibilityRequest(
    @Schema(description = "문서 공개 범위", example = "PROJECT_SHARED")
    @NotNull(message = "{validation.not-null.todo-document-visibility}")
    TodoDocumentVisibility visibility
) {}
