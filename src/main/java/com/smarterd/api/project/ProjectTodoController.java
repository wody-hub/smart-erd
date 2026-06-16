package com.smarterd.api.project;

import com.smarterd.api.project.dto.todo.CreateProjectTodoRequest;
import com.smarterd.api.project.dto.todo.ProjectTodoResponse;
import com.smarterd.api.project.dto.todo.TodoDocumentResponse;
import com.smarterd.api.project.dto.todo.UpdateProjectTodoRequest;
import com.smarterd.api.project.dto.todo.UpdateTodoDocumentVisibilityRequest;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프로젝트 컨텍스트 개인 TODO REST 컨트롤러.
 */
@Tag(name = "Project Todos", description = "개인 TODO 관리 API")
@RestController
@RequestMapping("/api/teams/{teamId}/projects/{projectId}/todos")
@RequiredArgsConstructor
public class ProjectTodoController {

    private final ProjectTodoService projectTodoService;

    @Operation(summary = "내 TODO 목록 조회")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = ProjectTodoResponse.class))
    )
    @GetMapping
    public ResponseEntity<List<ProjectTodoResponse>> getProjectTodos(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(
            projectTodoService
                .getProjectTodos(jwt.getSubject(), teamId, projectId)
                .stream()
                .map(ProjectTodoResponse::from)
                .toList()
        );
    }

    @Operation(summary = "내 TODO 상세 조회")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = ProjectTodoResponse.class))
    )
    @GetMapping("/{todoId}")
    public ResponseEntity<ProjectTodoResponse> getProjectTodo(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId
    ) {
        return ResponseEntity.ok(
            ProjectTodoResponse.from(projectTodoService.getProjectTodo(jwt.getSubject(), teamId, projectId, todoId))
        );
    }

    @Operation(summary = "내 TODO 생성")
    @ApiResponse(
        responseCode = "201",
        description = "생성 성공",
        content = @Content(schema = @Schema(implementation = ProjectTodoResponse.class))
    )
    @PostMapping
    public ResponseEntity<ProjectTodoResponse> createProjectTodo(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Valid @RequestBody CreateProjectTodoRequest request
    ) {
        final var result = projectTodoService.createProjectTodo(
            jwt.getSubject(),
            teamId,
            projectId,
            new ProjectTodoService.CreateProjectTodoCommand(
                request.title(),
                request.description(),
                request.status(),
                request.priority(),
                request.targetDate(),
                request.progressRate(),
                request.linkedWbsItemId()
            )
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ProjectTodoResponse.from(result));
    }

    @Operation(summary = "내 TODO 수정")
    @ApiResponse(
        responseCode = "200",
        description = "수정 성공",
        content = @Content(schema = @Schema(implementation = ProjectTodoResponse.class))
    )
    @PutMapping("/{todoId}")
    public ResponseEntity<ProjectTodoResponse> updateProjectTodo(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId,
        @Valid @RequestBody UpdateProjectTodoRequest request
    ) {
        final var result = projectTodoService.updateProjectTodo(
            jwt.getSubject(),
            teamId,
            projectId,
            todoId,
            new ProjectTodoService.UpdateProjectTodoCommand(
                request.title(),
                request.description(),
                request.status(),
                request.priority(),
                request.targetDate(),
                request.progressRate()
            )
        );
        return ResponseEntity.ok(ProjectTodoResponse.from(result));
    }

    @Operation(summary = "내 TODO 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공", content = @Content)
    @DeleteMapping("/{todoId}")
    public ResponseEntity<Void> deleteProjectTodo(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId
    ) {
        projectTodoService.deleteProjectTodo(jwt.getSubject(), teamId, projectId, todoId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "내 TODO 연결 문서 목록 조회")
    @ApiResponse(
        responseCode = "200",
        description = "조회 성공",
        content = @Content(schema = @Schema(implementation = TodoDocumentResponse.class))
    )
    @GetMapping("/{todoId}/documents")
    public ResponseEntity<List<TodoDocumentResponse>> getTodoDocuments(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId
    ) {
        return ResponseEntity.ok(
            projectTodoService
                .getTodoDocuments(jwt.getSubject(), teamId, projectId, todoId)
                .stream()
                .map(TodoDocumentResponse::from)
                .toList()
        );
    }

    @Operation(summary = "내 TODO에 문서 연결")
    @ApiResponse(
        responseCode = "200",
        description = "문서 연결 성공",
        content = @Content(schema = @Schema(implementation = TodoDocumentResponse.class))
    )
    @PutMapping("/{todoId}/documents/{documentId}")
    public ResponseEntity<TodoDocumentResponse> linkDocument(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId,
        @Parameter(description = "문서 ID") @PathVariable Long documentId,
        @Valid @RequestBody UpdateTodoDocumentVisibilityRequest request
    ) {
        return ResponseEntity.ok(
            TodoDocumentResponse.from(
                projectTodoService.linkDocument(
                    jwt.getSubject(),
                    teamId,
                    projectId,
                    todoId,
                    documentId,
                    request.visibility()
                )
            )
        );
    }

    @Operation(summary = "내 TODO 문서 연결 해제")
    @ApiResponse(responseCode = "204", description = "문서 연결 해제 성공", content = @Content)
    @DeleteMapping("/{todoId}/documents/{documentId}")
    public ResponseEntity<Void> unlinkDocument(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId,
        @Parameter(description = "문서 ID") @PathVariable Long documentId
    ) {
        projectTodoService.unlinkDocument(jwt.getSubject(), teamId, projectId, todoId, documentId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "내 TODO를 WBS에 연결")
    @ApiResponse(
        responseCode = "200",
        description = "WBS 연결 성공",
        content = @Content(schema = @Schema(implementation = ProjectTodoResponse.class))
    )
    @PutMapping("/{todoId}/wbs/{wbsItemId}")
    public ResponseEntity<ProjectTodoResponse> linkTodoToWbs(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId,
        @Parameter(description = "WBS 항목 ID") @PathVariable Long wbsItemId
    ) {
        return ResponseEntity.ok(
            ProjectTodoResponse.from(
                projectTodoService.linkTodoToWbs(jwt.getSubject(), teamId, projectId, todoId, wbsItemId)
            )
        );
    }

    @Operation(summary = "내 TODO의 WBS 연결 해제")
    @ApiResponse(
        responseCode = "200",
        description = "WBS 연결 해제 성공",
        content = @Content(schema = @Schema(implementation = ProjectTodoResponse.class))
    )
    @DeleteMapping("/{todoId}/wbs")
    public ResponseEntity<ProjectTodoResponse> unlinkTodoFromWbs(
        @AuthenticationPrincipal Jwt jwt,
        @Parameter(description = "팀 ID") @PathVariable Long teamId,
        @Parameter(description = "프로젝트 ID") @PathVariable Long projectId,
        @Parameter(description = "TODO ID") @PathVariable Long todoId
    ) {
        return ResponseEntity.ok(
            ProjectTodoResponse.from(projectTodoService.unlinkTodoFromWbs(jwt.getSubject(), teamId, projectId, todoId))
        );
    }
}
