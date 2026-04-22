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
import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.staffing.entity.StaffingGrade;
import com.smarterd.domain.pm.staffing.service.ProjectStaffingService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
class ProjectStaffingControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private ProjectStaffingService projectStaffingService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var controller = new ProjectStaffingController(projectStaffingService);
        final var messageSource = new StaticMessageSource();
        messageSource.setUseCodeAsDefaultMessage(true);
        messageSource.addMessage(
            MessageCode.ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER.code(),
            Locale.ENGLISH,
            "duplicate"
        );
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code(), Locale.ENGLISH, "not member");
        messageSource.addMessage(
            MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code(),
            Locale.ENGLISH,
            "viewer read only"
        );

        this.mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler(messageSource))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getProjectStaffing_returnsResourcesSummaryAndMonths() throws Exception {
        when(projectStaffingService.getProjectStaffing("tester", 1L, 10L)).thenReturn(sampleListResult());

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/staffing").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.resources[0].id").value(100))
            .andExpect(jsonPath("$.summary.plannedCost").value(10000000))
            .andExpect(jsonPath("$.months[0]").value("2026-04"));
    }

    @Test
    void createProjectStaffing_returnsCreated() throws Exception {
        when(
            projectStaffingService.createProjectStaffing(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(ProjectStaffingService.CreateProjectStaffingCommand.class)
            )
        ).thenReturn(sampleResourceResult(101L));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validCreatePayload()))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(101))
            .andExpect(jsonPath("$.memberName").value("Member"));
    }

    @Test
    void updateProjectStaffing_returnsUpdatedResource() throws Exception {
        when(
            projectStaffingService.updateProjectStaffing(
                eq("tester"),
                eq(1L),
                eq(10L),
                eq(100L),
                any(ProjectStaffingService.UpdateProjectStaffingCommand.class)
            )
        ).thenReturn(sampleResourceResult(100L));

        mockMvc
            .perform(
                put("/api/teams/1/projects/10/staffing/100")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validUpdatePayload()))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(100))
            .andExpect(jsonPath("$.plannedCost").value(10000000));
    }

    @Test
    void deleteProjectStaffing_returnsNoContent() throws Exception {
        mockMvc
            .perform(
                delete("/api/teams/1/projects/10/staffing/100").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isNoContent());
    }

    @Test
    void duplicateCreate_returnsConflict409() throws Exception {
        when(
            projectStaffingService.createProjectStaffing(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(ProjectStaffingService.CreateProjectStaffingCommand.class)
            )
        ).thenThrow(new DuplicateException(MessageCode.ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER.code(), "member"));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validCreatePayload()))
            )
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void nonTeamMemberCreate_returnsForbidden403() throws Exception {
        when(
            projectStaffingService.createProjectStaffing(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(ProjectStaffingService.CreateProjectStaffingCommand.class)
            )
        ).thenThrow(new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code()));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validCreatePayload()))
            )
            .andExpect(status().isForbidden());
    }

    @Test
    void invalidActualPair_returnsBadRequest400() throws Exception {
        final var payload = new LinkedHashMap<>(validCreatePayload());
        payload.put("actualStartDate", "2026-04-10");

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
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
    void invalidPlannedDateOrder_returnsBadRequest400() throws Exception {
        final var payload = new LinkedHashMap<>(validCreatePayload());
        payload.put("plannedStartDate", "2026-05-01");
        payload.put("plannedEndDate", "2026-04-01");

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
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
    void invalidActualDateOrder_returnsBadRequest400() throws Exception {
        final var payload = new LinkedHashMap<>(validCreatePayload());
        payload.put("actualStartDate", "2026-04-30");
        payload.put("actualEndDate", "2026-04-01");
        payload.put("actualParticipationRate", 50);

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
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
    void negativeMonthlyRate_returnsBadRequest400() throws Exception {
        final var payload = new LinkedHashMap<>(validCreatePayload());
        payload.put("monthlyRate", -1);

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
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
    void monthlyRateAboveCap_returnsBadRequest400() throws Exception {
        final var payload = new LinkedHashMap<>(validCreatePayload());
        payload.put("monthlyRate", 1_000_000_000L);

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
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
    void participationOutsideRange_returnsBadRequest400() throws Exception {
        final var plannedInvalidPayload = new LinkedHashMap<>(validCreatePayload());
        plannedInvalidPayload.put("plannedParticipationRate", 101);

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(plannedInvalidPayload))
            )
            .andExpect(status().isBadRequest());

        final var actualInvalidPayload = new LinkedHashMap<>(validCreatePayload());
        actualInvalidPayload.put("actualStartDate", "2026-04-01");
        actualInvalidPayload.put("actualEndDate", "2026-04-30");
        actualInvalidPayload.put("actualParticipationRate", 101);

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(actualInvalidPayload))
            )
            .andExpect(status().isBadRequest());
    }

    @Test
    void viewerCanGetButCannotMutate() throws Exception {
        when(projectStaffingService.getProjectStaffing("viewer", 1L, 10L)).thenReturn(sampleListResult());
        when(
            projectStaffingService.createProjectStaffing(
                eq("viewer"),
                eq(1L),
                eq(10L),
                any(ProjectStaffingService.CreateProjectStaffingCommand.class)
            )
        ).thenThrow(new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code()));
        when(
            projectStaffingService.updateProjectStaffing(
                eq("viewer"),
                eq(1L),
                eq(10L),
                eq(100L),
                any(ProjectStaffingService.UpdateProjectStaffingCommand.class)
            )
        ).thenThrow(new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code()));
        org.mockito.Mockito.doThrow(new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code()))
            .when(projectStaffingService)
            .deleteProjectStaffing("viewer", 1L, 10L, 100L);

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/staffing").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                    return request;
                })
            )
            .andExpect(status().isOk());

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/staffing")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validCreatePayload()))
            )
            .andExpect(status().isForbidden());

        mockMvc
            .perform(
                put("/api/teams/1/projects/10/staffing/100")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(validUpdatePayload()))
            )
            .andExpect(status().isForbidden());

        mockMvc
            .perform(
                delete("/api/teams/1/projects/10/staffing/100").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                    return request;
                })
            )
            .andExpect(status().isForbidden());
    }

    private ProjectStaffingService.ProjectStaffingListResult sampleListResult() {
        final var resource = sampleResourceResult(100L);
        return new ProjectStaffingService.ProjectStaffingListResult(
            List.of(resource),
            new ProjectStaffingService.ProjectStaffingSummaryResult(
                new BigDecimal("1.00"),
                new BigDecimal("0.80"),
                new BigDecimal("-0.20"),
                10_000_000L,
                8_000_000L
            ),
            List.of("2026-04")
        );
    }

    private ProjectStaffingService.ProjectStaffingResourceResult sampleResourceResult(Long id) {
        return new ProjectStaffingService.ProjectStaffingResourceResult(
            id,
            7L,
            "Member",
            "member",
            StaffingGrade.MIDDLE,
            10_000_000L,
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            100,
            new BigDecimal("1.00"),
            10_000_000L,
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-24"),
            100,
            new BigDecimal("0.80"),
            8_000_000L,
            new BigDecimal("-0.20"),
            List.of(
                new ProjectStaffingService.ProjectStaffingMonthlyAllocationResult(
                    "2026-04",
                    new BigDecimal("1.00"),
                    new BigDecimal("0.80"),
                    new BigDecimal("-0.20")
                )
            ),
            Instant.parse("2026-04-22T00:00:00Z"),
            Instant.parse("2026-04-22T00:00:00Z")
        );
    }

    private Map<String, Object> validCreatePayload() {
        final var payload = new LinkedHashMap<String, Object>();
        payload.put("userId", 7);
        payload.put("grade", "MIDDLE");
        payload.put("monthlyRate", 10_000_000L);
        payload.put("plannedStartDate", "2026-04-01");
        payload.put("plannedEndDate", "2026-04-30");
        payload.put("plannedParticipationRate", 100);
        return payload;
    }

    private Map<String, Object> validUpdatePayload() {
        final var payload = new LinkedHashMap<String, Object>();
        payload.put("grade", "MIDDLE");
        payload.put("monthlyRate", 10_000_000L);
        payload.put("plannedStartDate", "2026-04-01");
        payload.put("plannedEndDate", "2026-04-30");
        payload.put("plannedParticipationRate", 100);
        return payload;
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
