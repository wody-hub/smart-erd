package com.smarterd.api.ai;

import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.application.ai.AiExecutionGateway;
import com.smarterd.application.ai.AiExecutionState;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Instant;
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
class AiProviderControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private AiExecutionGateway aiExecutionGateway;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var messageSource = new StaticMessageSource();
        messageSource.setUseCodeAsDefaultMessage(true);
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code(), Locale.ENGLISH, "forbidden");
        this.mockMvc = MockMvcBuilders.standaloneSetup(new AiProviderController(aiExecutionGateway))
            .setControllerAdvice(new GlobalExceptionHandler(messageSource))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getStatusReturnsSafeProviderStatus() throws Exception {
        when(aiExecutionGateway.status())
            .thenReturn(new AiExecutionGateway.AiProviderStatusView("noop", "NOT_CONFIGURED", null, Instant.EPOCH));

        mockMvc
            .perform(
                get("/api/ai/provider/status").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.provider").value("noop"))
            .andExpect(jsonPath("$.availability").value("NOT_CONFIGURED"));
    }

    @Test
    void executeReturnsFinalResultWithExecutionId() throws Exception {
        when(aiExecutionGateway.execute(org.mockito.ArgumentMatchers.eq("tester"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(
                new AiExecutionGateway.AiExecutionView(
                    "exec-1",
                    "noop",
                    "provider-response-v1",
                    AiExecutionState.FAILED,
                    Instant.EPOCH,
                    Instant.EPOCH,
                    Instant.EPOCH,
                    0L,
                    null,
                    List.of(),
                    new AiProviderError("NOT_CONFIGURED", "Not configured", "No provider", false)
                )
            );

        mockMvc
            .perform(
                post("/api/ai/provider/execute")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "status?")))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.executionId").value("exec-1"))
            .andExpect(jsonPath("$.status").value("FAILED"))
            .andExpect(jsonPath("$.error.type").value("NOT_CONFIGURED"));
    }

    @Test
    void getExecutionCrossUserDenialReturnsForbidden() throws Exception {
        when(aiExecutionGateway.getExecution("tester", "exec-1"))
            .thenThrow(new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code()));

        mockMvc
            .perform(
                get("/api/ai/provider/executions/exec-1").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isForbidden());
    }

    @Test
    void cancelExecutionReturnsTerminalStatus() throws Exception {
        when(aiExecutionGateway.cancelExecution("tester", "exec-1"))
            .thenReturn(
                new AiExecutionGateway.AiExecutionView(
                    "exec-1",
                    "noop",
                    "provider-response-v1",
                    AiExecutionState.CANCELLED,
                    Instant.EPOCH,
                    Instant.EPOCH,
                    Instant.EPOCH,
                    0L,
                    null,
                    List.of(),
                    null
                )
            );

        mockMvc
            .perform(
                post("/api/ai/provider/executions/exec-1/cancel").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
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
