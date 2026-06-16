package com.smarterd.api.ai;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.application.ai.history.AiProjectHistoryItemView;
import com.smarterd.application.ai.history.AiProjectHistoryService;
import com.smarterd.application.ai.history.AiProjectHistoryView;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@ExtendWith(MockitoExtension.class)
class AiProjectHistoryControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private AiProjectHistoryService historyService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        final var messageSource = new StaticMessageSource();
        messageSource.setUseCodeAsDefaultMessage(true);
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code(), Locale.ENGLISH, "forbidden");
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code(), Locale.ENGLISH, "not member");
        this.mockMvc = MockMvcBuilders.standaloneSetup(new AiProjectHistoryController(historyService))
            .setControllerAdvice(new GlobalExceptionHandler(messageSource))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
    }

    @Test
    @DisplayName("11-W2-03 controller owns project AI history route")
    void w2_11_W2_03_controllerOwnsProjectAiHistoryRoute() throws Exception {
        final var classMapping = AiProjectHistoryController.class.getAnnotation(RequestMapping.class);
        final var method = AiProjectHistoryController.class.getDeclaredMethod(
            "getProjectHistory",
            Jwt.class,
            Long.class,
            Long.class,
            Integer.class
        );
        final var getMapping = method.getAnnotation(GetMapping.class);

        Assertions.assertThat(classMapping.value()).containsExactly(
            "/api/teams/{teamId}/projects/{projectId}/ai-history"
        );
        Assertions.assertThat(getMapping.value()).isEmpty();
    }

    @Test
    @DisplayName("11-W2-03 anonymous project AI history is rejected")
    void w2_11_W2_03_anonymousProjectAiHistoryIsRejected() throws Exception {
        mockMvc.perform(get("/api/teams/1/projects/10/ai-history")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("11-W2-03 project AI history returns sanitized rows")
    void w2_11_W2_03_projectAiHistoryReturnsSanitizedRows() throws Exception {
        when(historyService.getProjectHistory("viewer", 1L, 10L, 25)).thenReturn(history());

        final var response = mockMvc
            .perform(
                get("/api/teams/1/projects/10/ai-history")
                    .param("limit", "25")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                        return request;
                    })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.limit").value(25))
            .andExpect(jsonPath("$.hasMore").value(false))
            .andExpect(jsonPath("$.items[0].executionId").value("exec-1"))
            .andExpect(jsonPath("$.items[0].proposalId").value("proposal-1"))
            .andExpect(jsonPath("$.items[0].status").value("PROPOSAL_REJECTED"))
            .andExpect(jsonPath("$.items[0].summary").value("Unsupported action"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        Assertions.assertThat(response)
            .doesNotContain("payload")
            .doesNotContain("rawPrompt")
            .doesNotContain("rawContext")
            .doesNotContain("stdout")
            .doesNotContain("stderr")
            .doesNotContain("cookie")
            .doesNotContain("env");
    }

    @Test
    @DisplayName("11-W2-03 limit parameter is delegated to service")
    void w2_11_W2_03_limitParameterIsDelegatedToService() throws Exception {
        when(
            historyService.getProjectHistory(
                org.mockito.ArgumentMatchers.eq("viewer"),
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(history());

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/ai-history")
                    .param("limit", "75")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                        return request;
                    })
            )
            .andExpect(status().isOk());

        final var captor = ArgumentCaptor.forClass(Integer.class);
        org.mockito.Mockito.verify(historyService).getProjectHistory(
            org.mockito.ArgumentMatchers.eq("viewer"),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(10L),
            captor.capture()
        );
        Assertions.assertThat(captor.getValue()).isEqualTo(75);
    }

    @Test
    @DisplayName("11-W2-03 project authorization failure maps to forbidden")
    void w2_11_W2_03_projectAuthorizationFailureMapsToForbidden() throws Exception {
        when(historyService.getProjectHistory("viewer", 1L, 10L, 50)).thenThrow(
            new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code())
        );

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/ai-history").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("viewer"));
                    return request;
                })
            )
            .andExpect(status().isForbidden());
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }

    private AiProjectHistoryView history() {
        return new AiProjectHistoryView(
            25,
            false,
            List.of(
                new AiProjectHistoryItemView(
                    "AUDIT",
                    "exec-1",
                    "proposal-1",
                    "noop",
                    "provider-response-v1",
                    "issue.create",
                    "LOW",
                    "PROPOSAL_REJECTED",
                    "issue",
                    "ISS-1",
                    "Risk issue",
                    "Unsupported action",
                    "viewer",
                    "viewer",
                    Instant.EPOCH,
                    Instant.EPOCH.plusSeconds(1),
                    "Unsupported action",
                    "No executor is registered for this action type.",
                    Instant.EPOCH.plusSeconds(1)
                )
            )
        );
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
