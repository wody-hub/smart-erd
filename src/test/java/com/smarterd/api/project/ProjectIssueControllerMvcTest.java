package com.smarterd.api.project;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.domain.pm.issue.service.ProjectIssueService;
import com.smarterd.utils.excel.ExcelData;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.StaticMessageSource;
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
class ProjectIssueControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private ProjectIssueService projectIssueService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var controller = new ProjectIssueController(projectIssueService);
        final var messageSource = new StaticMessageSource();
        messageSource.setUseCodeAsDefaultMessage(true);
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code(), Locale.ENGLISH, "not member");
        messageSource.addMessage(
            MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code(),
            Locale.ENGLISH,
            "viewer read only"
        );
        messageSource.addMessage(
            MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_STATUS_TRANSITION_INVALID.code(),
            Locale.ENGLISH,
            "invalid transition"
        );

        this.mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler(messageSource))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getProjectIssues_returnsFilteredList() throws Exception {
        when(
            projectIssueService.getProjectIssues(
                "tester",
                1L,
                10L,
                new ProjectIssueService.ProjectIssueQuery(
                    List.of(ProjectIssueStatus.REGISTERED),
                    List.of(ProjectIssuePriority.HIGH),
                    List.of(7L),
                    true
                )
            )
        ).thenReturn(List.of(sampleResult(100L, ProjectIssueStatus.REGISTERED, ProjectIssuePriority.HIGH)));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/issues")
                    .param("status", "REGISTERED")
                    .param("priority", "HIGH")
                    .param("assigneeUserId", "7")
                    .param("unassignedOnly", "true")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].id").value(100))
            .andExpect(jsonPath("$.items[0].status").value("REGISTERED"))
            .andExpect(jsonPath("$.items[0].priority").value("HIGH"))
            .andExpect(jsonPath("$.summary.totalCount").value(1))
            .andExpect(jsonPath("$.summary.registeredCount").value(1))
            .andExpect(jsonPath("$.summary.inProgressCount").value(0))
            .andExpect(jsonPath("$.summary.doneCount").value(0));
    }

    @Test
    void createProjectIssue_returnsCreated() throws Exception {
        when(
            projectIssueService.createProjectIssue(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(ProjectIssueService.CreateProjectIssueCommand.class)
            )
        ).thenReturn(sampleResult(101L, ProjectIssueStatus.REGISTERED, ProjectIssuePriority.MEDIUM));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/issues")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validCreatePayload()))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(101))
            .andExpect(jsonPath("$.status").value("REGISTERED"));
    }

    @Test
    void updateProjectIssue_returnsUpdatedIssue() throws Exception {
        when(
            projectIssueService.updateProjectIssue(
                eq("tester"),
                eq(1L),
                eq(10L),
                eq(100L),
                any(ProjectIssueService.UpdateProjectIssueCommand.class)
            )
        ).thenReturn(sampleResult(100L, ProjectIssueStatus.IN_PROGRESS, ProjectIssuePriority.HIGH));

        mockMvc
            .perform(
                put("/api/teams/1/projects/10/issues/100")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validUpdatePayload()))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(100))
            .andExpect(jsonPath("$.priority").value("HIGH"));
    }

    @Test
    void updateProjectIssueStatus_returnsUpdatedIssue() throws Exception {
        when(projectIssueService.updateProjectIssueStatus("tester", 1L, 10L, 100L, ProjectIssueStatus.IN_PROGRESS))
            .thenReturn(
            sampleResult(100L, ProjectIssueStatus.IN_PROGRESS, ProjectIssuePriority.HIGH)
        );

        mockMvc
            .perform(
                patch("/api/teams/1/projects/10/issues/100/status")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("status", "IN_PROGRESS")))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    void downloadProjectIssuesExcel_returnsExcelAttachment() throws Exception {
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("프로젝트 이슈").createRow(0).createCell(0).setCellValue("프로젝트 이슈");
        when(
            projectIssueService.exportProjectIssues(
                "tester",
                1L,
                10L,
                new ProjectIssueService.ProjectIssueQuery(
                    List.of(ProjectIssueStatus.IN_PROGRESS),
                    List.of(ProjectIssuePriority.HIGH),
                    List.of(7L),
                    true
                )
            )
        ).thenReturn(new ExcelData(workbook, "phoenix-issues"));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/issues/download/excel")
                    .param("status", "IN_PROGRESS")
                    .param("priority", "HIGH")
                    .param("assigneeUserId", "7")
                    .param("unassignedOnly", "true")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
            )
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("phoenix-issues.xlsx")));

        verify(projectIssueService).exportProjectIssues(
            "tester",
            1L,
            10L,
            new ProjectIssueService.ProjectIssueQuery(
                List.of(ProjectIssueStatus.IN_PROGRESS),
                List.of(ProjectIssuePriority.HIGH),
                List.of(7L),
                true
            )
        );
    }

    @Test
    void invalidCreate_blankTitle_returnsBadRequest() throws Exception {
        final var payload = new LinkedHashMap<>(validCreatePayload());
        payload.put("title", "   ");

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/issues")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(payload))
            )
            .andExpect(status().isBadRequest());
    }

    @Test
    void viewerUpdateStatus_returnsForbidden() throws Exception {
        when(projectIssueService.updateProjectIssueStatus("tester", 1L, 10L, 100L, ProjectIssueStatus.IN_PROGRESS))
            .thenThrow(
            new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code())
        );

        mockMvc
            .perform(
                patch("/api/teams/1/projects/10/issues/100/status")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("status", "IN_PROGRESS")))
            )
            .andExpect(status().isForbidden());
    }

    private ProjectIssueService.ProjectIssueResult sampleResult(
        Long id,
        ProjectIssueStatus status,
        ProjectIssuePriority priority
    ) {
        return new ProjectIssueService.ProjectIssueResult(
            id,
            "API 응답 정렬 규칙 보완",
            "status/priority 필터와 export 결과가 일치해야 한다.",
            priority,
            status,
            7L,
            "kim",
            "김개발",
            Instant.parse("2026-04-23T00:00:00Z"),
            Instant.parse("2026-04-23T01:00:00Z")
        );
    }

    private Map<String, Object> validCreatePayload() {
        return Map.of(
            "title",
            "API 응답 정렬 규칙 보완",
            "description",
            "status/priority 필터와 export 결과가 일치해야 한다.",
            "priority",
            "HIGH",
            "assigneeUserId",
            7
        );
    }

    private Map<String, Object> validUpdatePayload() {
        return Map.of(
            "title",
            "정렬 규칙 수정 반영",
            "description",
            "기본 정렬을 서버에서 고정한다.",
            "priority",
            "HIGH",
            "assigneeUserId",
            7
        );
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
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
