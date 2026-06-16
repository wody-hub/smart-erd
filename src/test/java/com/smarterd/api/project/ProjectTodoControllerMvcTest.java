package com.smarterd.api.project;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.pm.todo.entity.ProjectTodoPriority;
import com.smarterd.domain.pm.todo.entity.ProjectTodoStatus;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import com.smarterd.domain.pm.todo.service.ProjectTodoService;
import com.smarterd.domain.pm.todo.service.ProjectTodoService.ProjectTodoResult;
import com.smarterd.domain.pm.todo.service.ProjectTodoService.SharedTodoSummaryResult;
import com.smarterd.domain.pm.todo.service.ProjectTodoService.TodoDocumentResult;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@ExtendWith(MockitoExtension.class)
class ProjectTodoControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private ProjectTodoService projectTodoService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.standaloneSetup(
            new ProjectTodoController(projectTodoService),
            new WbsTodoController(projectTodoService)
        )
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getProjectTodos_returnsOwnerList() throws Exception {
        when(projectTodoService.getProjectTodos("tester", 1L, 10L)).thenReturn(List.of(sampleTodo()));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/todos").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(301))
            .andExpect(jsonPath("$[0].title").value("응답 계약 정리"));
    }

    @Test
    void createProjectTodo_returnsCreated() throws Exception {
        when(
            projectTodoService.createProjectTodo(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(ProjectTodoService.CreateProjectTodoCommand.class)
            )
        ).thenReturn(sampleTodo());

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/todos")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "title",
                                "응답 계약 정리",
                                "status",
                                "TODO",
                                "priority",
                                "HIGH",
                                "progressRate",
                                20
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(301))
            .andExpect(jsonPath("$.priority").value("HIGH"));
    }

    @Test
    void linkDocument_returnsUpdatedDocument() throws Exception {
        when(
            projectTodoService.linkDocument("tester", 1L, 10L, 301L, 42L, TodoDocumentVisibility.PROJECT_SHARED)
        ).thenReturn(sampleDocument(42L, TodoDocumentVisibility.PROJECT_SHARED));

        mockMvc
            .perform(
                put("/api/teams/1/projects/10/todos/301/documents/42")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(java.util.Map.of("visibility", "PROJECT_SHARED")))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(42))
            .andExpect(jsonPath("$.visibility").value("PROJECT_SHARED"));
    }

    @Test
    void unlinkTodoFromWbs_returnsUpdatedTodo() throws Exception {
        when(projectTodoService.unlinkTodoFromWbs("tester", 1L, 10L, 301L)).thenReturn(sampleTodoWithoutWbs());

        mockMvc
            .perform(
                delete("/api/teams/1/projects/10/todos/301/wbs").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.linkedWbsItemId").isEmpty());
    }

    @Test
    void getSharedTodoSummaries_returnsSharedProjection() throws Exception {
        when(projectTodoService.getSharedTodoSummariesByWbs("tester", 1L, 10L, 100L)).thenReturn(
            List.of(sampleSharedSummary())
        );

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/100/todos").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].ownerName").value("김개발"))
            .andExpect(jsonPath("$[0].sharedDocuments[0].visibility").value("PROJECT_SHARED"));
    }

    private ProjectTodoResult sampleTodo() {
        return new ProjectTodoResult(
            301L,
            "응답 계약 정리",
            "private note",
            ProjectTodoStatus.IN_PROGRESS,
            ProjectTodoPriority.HIGH,
            LocalDate.parse("2026-04-30"),
            20,
            100L,
            "백엔드 API",
            Instant.parse("2026-04-28T03:00:00Z"),
            Instant.parse("2026-04-28T03:05:00Z")
        );
    }

    private ProjectTodoResult sampleTodoWithoutWbs() {
        return new ProjectTodoResult(
            301L,
            "응답 계약 정리",
            "private note",
            ProjectTodoStatus.IN_PROGRESS,
            ProjectTodoPriority.HIGH,
            LocalDate.parse("2026-04-30"),
            20,
            null,
            null,
            Instant.parse("2026-04-28T03:00:00Z"),
            Instant.parse("2026-04-28T03:05:00Z")
        );
    }

    private SharedTodoSummaryResult sampleSharedSummary() {
        return new SharedTodoSummaryResult(
            301L,
            "응답 계약 정리",
            ProjectTodoStatus.IN_PROGRESS,
            ProjectTodoPriority.HIGH,
            LocalDate.parse("2026-04-30"),
            20,
            7L,
            "김개발",
            List.of(sampleDocument(42L, TodoDocumentVisibility.PROJECT_SHARED))
        );
    }

    private TodoDocumentResult sampleDocument(Long id, TodoDocumentVisibility visibility) {
        return new TodoDocumentResult(
            301L,
            id,
            "API Spec",
            "markdown",
            "technical-spec",
            "Technical Spec",
            "summary",
            List.of("spec"),
            visibility,
            Instant.parse("2026-04-28T03:10:00Z"),
            Instant.parse("2026-04-28T03:00:00Z"),
            Instant.parse("2026-04-28T03:05:00Z")
        );
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).claim("sub", subject).build();
    }

    private static final class TestJwtArgumentResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return (
                parameter.hasParameterAnnotation(AuthenticationPrincipal.class) &&
                Jwt.class.isAssignableFrom(parameter.getParameterType())
            );
        }

        @Override
        public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
        ) {
            return webRequest
                .getNativeRequest(jakarta.servlet.http.HttpServletRequest.class)
                .getAttribute(TEST_JWT_REQUEST_ATTRIBUTE);
        }
    }
}
