package com.smarterd.api.project.dto.todo;

import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 개인 TODO 생성 요청 DTO.
 */
@Schema(description = "개인 TODO 생성 요청")
public record CreateProjectTodoRequest(
    @Schema(description = "TODO 제목", example = "API 응답 계약 정리")
    @NotBlank(message = "{validation.not-blank.todo-title}")
    @Size(max = ProjectTodo.MAX_TITLE_LENGTH, message = "{validation.size.todo-title}")
    String title,

    @Schema(description = "개인 메모/설명", example = "프런트와 공유할 필드를 확정한다.")
    @Nullable
    @Size(max = ProjectTodo.MAX_DESCRIPTION_LENGTH, message = "{validation.size.todo-description}")
    String description,

    @Schema(description = "TODO 상태", example = "TODO") @Nullable ProjectTodoStatus status,

    @Schema(description = "TODO 우선순위", example = "HIGH") @Nullable ProjectTodoPriority priority,

    @Schema(description = "목표일", example = "2026-04-30") @Nullable LocalDate targetDate,

    @Schema(description = "진척률 (0~100)", example = "20")
    @Nullable
    @Min(value = 0, message = "{validation.min.todo-progress-rate}")
    @Max(value = 100, message = "{validation.max.todo-progress-rate}")
    Integer progressRate,

    @Schema(description = "초기 연결 WBS 항목 ID", example = "100") @Nullable Long linkedWbsItemId
) {}
