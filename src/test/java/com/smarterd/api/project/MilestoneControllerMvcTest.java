package com.smarterd.api.project;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.pm.milestone.service.MilestoneService;
import com.smarterd.domain.pm.milestone.service.MilestoneService.MilestoneResult;
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
class MilestoneControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private MilestoneService milestoneService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var controller = new MilestoneController(milestoneService);
        this.mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getMilestones_returnsList() throws Exception {
        when(milestoneService.getMilestones("tester", 1L, 10L)).thenReturn(
            List.of(sampleResult(100L, "요구사항 확정", 75, true))
        );

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/milestones").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(100))
            .andExpect(jsonPath("$[0].achievementRate").value(75))
            .andExpect(jsonPath("$[0].isDelayed").value(true));
    }

    @Test
    void createMilestone_returnsCreated() throws Exception {
        when(
            milestoneService.createMilestone(
                eq("tester"),
                eq(1L),
                eq(10L),
                eq("요구사항 확정"),
                eq(LocalDate.parse("2026-05-31")),
                eq("분석 산출물 완료")
            )
        ).thenReturn(sampleResult(101L, "요구사항 확정", 0, false));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/milestones")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "name",
                                "요구사항 확정",
                                "targetDate",
                                "2026-05-31",
                                "description",
                                "분석 산출물 완료"
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(101))
            .andExpect(jsonPath("$.name").value("요구사항 확정"));
    }

    private MilestoneResult sampleResult(Long id, String name, int achievementRate, boolean isDelayed) {
        return new MilestoneResult(
            id,
            10L,
            name,
            LocalDate.parse("2026-05-31"),
            null,
            0,
            0,
            achievementRate,
            isDelayed,
            Instant.parse("2026-04-14T00:00:00Z"),
            Instant.parse("2026-04-14T00:00:00Z")
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
