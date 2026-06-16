package com.smarterd.api.ai;

import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.application.ai.chat.AiChatExecutionService;
import com.smarterd.application.ai.chat.AiChatView;
import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposalStatus;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@ExtendWith(MockitoExtension.class)
class AiChatControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private AiChatExecutionService aiChatExecutionService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var messageSource = new StaticMessageSource();
        messageSource.setUseCodeAsDefaultMessage(true);
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code(), Locale.ENGLISH, "forbidden");
        this.mockMvc = MockMvcBuilders.standaloneSetup(new AiChatController(aiChatExecutionService))
            .setControllerAdvice(new GlobalExceptionHandler(messageSource))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("10-W0-03 controller owns chat-specific request mapping")
    void w0_10_W0_03_controllerOwnsChatSpecificRequestMapping() throws Exception {
        final var classMapping = AiChatController.class.getAnnotation(RequestMapping.class);
        final var method = AiChatController.class.getDeclaredMethod(
            "chat",
            Jwt.class,
            com.smarterd.api.ai.dto.AiChatRequest.class
        );
        final var postMapping = method.getAnnotation(PostMapping.class);

        org.assertj.core.api.Assertions.assertThat(classMapping.value()).containsExactly("/api/ai/chat");
        org.assertj.core.api.Assertions.assertThat(postMapping.value()).isEmpty();
    }

    @Test
    @DisplayName("10-W0-03 authenticated POST /api/ai/chat returns read-only structured answer")
    void w0_10_W0_03_authenticatedChatReturnsStructuredReadOnlyResponse() throws Exception {
        when(
            aiChatExecutionService.execute(
                org.mockito.ArgumentMatchers.eq("tester"),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(
            new AiChatView(
                "ANSWER",
                "Delayed issues need attention.",
                "API work is the main risk.",
                List.of("Delayed issues: 2"),
                List.of(),
                List.of(
                    new com.smarterd.application.ai.chat.AiReadContextService.SourceChip("Alpha Project", "issues", 12)
                ),
                List.of(),
                null
            )
        );

        mockMvc
            .perform(
                post("/api/ai/chat")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "status?"))
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ANSWER"))
            .andExpect(jsonPath("$.conclusion").value("Delayed issues need attention."))
            .andExpect(jsonPath("$.sourceChips[0].tool").value("issues"))
            .andExpect(jsonPath("$.actions").doesNotExist());
    }

    @Test
    @DisplayName("11-W2-01 chat response exposes sanitized proposal previews")
    void w2_11_W2_01_chatResponseExposesSanitizedProposalPreviews() throws Exception {
        when(
            aiChatExecutionService.execute(
                org.mockito.ArgumentMatchers.eq("tester"),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(
            new AiChatView(
                "ANSWER",
                "exec-1",
                false,
                null,
                null,
                "Issue summary loaded",
                "Create a follow-up issue.",
                List.of("Issue summary loaded"),
                List.of(),
                List.of(),
                List.of(),
                List.of(proposalView()),
                null,
                null
            )
        );

        final var response = mockMvc
            .perform(
                post("/api/ai/chat")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "create?"))
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.proposals[0].proposalId").value("proposal-1"))
            .andExpect(jsonPath("$.proposals[0].status").value("PENDING"))
            .andExpect(jsonPath("$.proposals[0].target.type").value("issue"))
            .andExpect(jsonPath("$.proposals[0].fields[0].afterValue").value("Follow-up"))
            .andExpect(jsonPath("$.actions").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();

        org.assertj.core.api.Assertions.assertThat(response)
            .doesNotContain("rawPrompt")
            .doesNotContain("rawContext")
            .doesNotContain("providerOutput");
    }

    @Test
    @DisplayName("10-W0-03 anonymous chat execution is rejected")
    void w0_10_W0_03_anonymousChatIsRejected() throws Exception {
        mockMvc
            .perform(
                post("/api/ai/chat")
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "status?"))
                    )
            )
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("10-W0-03 scope denial maps before provider invocation")
    void w0_10_W0_03_scopeDenialReturnsForbidden() throws Exception {
        when(
            aiChatExecutionService.execute(
                org.mockito.ArgumentMatchers.eq("tester"),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenThrow(new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code()));

        mockMvc
            .perform(
                post("/api/ai/chat")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "status?"))
                    )
            )
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("10-W0-03 confirmation response is returned without write controls")
    void w0_10_W0_03_confirmationResponseHasNoWriteControls() throws Exception {
        when(
            aiChatExecutionService.execute(
                org.mockito.ArgumentMatchers.eq("tester"),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(AiChatView.needsConfirmation(List.of("Select a project."), List.of()));

        mockMvc
            .perform(
                post("/api/ai/chat")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("teamId", 1, "userMessage", "status?")))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("NEEDS_CONFIRMATION"))
            .andExpect(jsonPath("$.needsConfirmation[0]").value("Select a project."))
            .andExpect(jsonPath("$.actions").doesNotExist())
            .andExpect(jsonPath("$.approval").doesNotExist());
    }

    @Test
    @DisplayName("10-W0-03 provider failure maps to localized safe error response")
    void w0_10_W0_03_providerFailureMapsToSafeErrorCardContract() throws Exception {
        when(
            aiChatExecutionService.execute(
                org.mockito.ArgumentMatchers.eq("tester"),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(
            new AiChatView("ERROR", "", "", List.of(), List.of(), List.of(), List.of(), "AI 응답을 만들지 못했습니다.")
        );

        mockMvc
            .perform(
                post("/api/ai/chat")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "status?"))
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ERROR"))
            .andExpect(jsonPath("$.error").value("AI 응답을 만들지 못했습니다."))
            .andExpect(jsonPath("$.actions").doesNotExist());
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }

    private AiActionProposalView proposalView() {
        return new AiActionProposalView(
            "proposal-1",
            AiActionProposalStatus.PENDING,
            false,
            "ISSUE_CREATE",
            AiActionRiskLevel.LOW,
            new AiActionProposalView.Target("issue", "ISS-1", "Follow-up", 1L, 10L),
            "Create issue",
            "Create a project issue",
            List.of(new AiActionProposalView.FieldChange("Title", null, "Follow-up", "ADD")),
            "",
            List.of(),
            Instant.EPOCH.plusSeconds(900),
            null,
            null,
            null
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
