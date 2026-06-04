package com.smarterd.api.ai;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.application.ai.proposal.AiActionProposalService;
import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.application.ai.provider.AiActionRiskLevel;
import com.smarterd.domain.ai.AiActionProposalStatus;
import com.smarterd.domain.common.message.MessageCode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.assertj.core.api.Assertions;
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
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@ExtendWith(MockitoExtension.class)
class AiActionProposalControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private AiActionProposalService proposalService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        final var messageSource = new StaticMessageSource();
        messageSource.setUseCodeAsDefaultMessage(true);
        messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code(), Locale.ENGLISH, "forbidden");
        this.mockMvc = MockMvcBuilders.standaloneSetup(new AiActionProposalController(proposalService))
            .setControllerAdvice(new GlobalExceptionHandler(messageSource))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
    }

    @Test
    @DisplayName("11-W2-02 GET proposal returns sanitized preview")
    void w2_11_W2_02_getProposalReturnsSanitizedPreview() throws Exception {
        when(proposalService.getProposal("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.PENDING));

        final var response = mockMvc
            .perform(
                get("/api/ai/proposals/proposal-1").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.proposalId").value("proposal-1"))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.target.type").value("issue"))
            .andExpect(jsonPath("$.fields[0].afterValue").value("Follow-up"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        Assertions.assertThat(response).doesNotContain("rawPrompt").doesNotContain("providerOutput");
    }

    @Test
    @DisplayName("11-W2-02 proposal endpoints require authentication")
    void w2_11_W2_02_proposalEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/ai/proposals/proposal-1")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/ai/proposals/proposal-1/approve")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/ai/proposals/proposal-1/cancel")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("11-W2-02 approve proposal returns decision message and updated status")
    void w2_11_W2_02_approveProposalReturnsDecisionMessage() throws Exception {
        when(proposalService.getProposal("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.PENDING));
        when(proposalService.approve("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.REJECTED));

        mockMvc
            .perform(
                post("/api/ai/proposals/proposal-1/approve").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value(MessageCode.ERROR_BUSINESS_AI_PROPOSAL_UNSUPPORTED_ACTION.code()))
            .andExpect(jsonPath("$.decision").value("APPROVE"))
            .andExpect(jsonPath("$.terminal").value(true))
            .andExpect(jsonPath("$.proposal.status").value("REJECTED"));
    }

    @Test
    @DisplayName("11-W2-02 repeated approve returns idempotent terminal response")
    void w2_11_W2_02_repeatedApproveReturnsIdempotentTerminalResponse() throws Exception {
        when(proposalService.getProposal("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.REJECTED));
        when(proposalService.approve("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.REJECTED));

        mockMvc
            .perform(
                post("/api/ai/proposals/proposal-1/approve").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value(MessageCode.ERROR_BUSINESS_AI_PROPOSAL_TERMINAL.code()))
            .andExpect(jsonPath("$.decision").value("IDEMPOTENT"))
            .andExpect(jsonPath("$.terminal").value(true))
            .andExpect(jsonPath("$.proposal.status").value("REJECTED"));
    }

    @Test
    @DisplayName("11-W2-02 cancel proposal returns cancel message")
    void w2_11_W2_02_cancelProposalReturnsCancelMessage() throws Exception {
        when(proposalService.getProposal("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.PENDING));
        when(proposalService.cancel("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.CANCELLED));

        mockMvc
            .perform(
                post("/api/ai/proposals/proposal-1/cancel").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("ai.proposal.cancelled"))
            .andExpect(jsonPath("$.decision").value("CANCEL"))
            .andExpect(jsonPath("$.terminal").value(true))
            .andExpect(jsonPath("$.proposal.status").value("CANCELLED"));
    }

    @Test
    @DisplayName("11-W2-02 repeated cancel returns idempotent terminal response")
    void w2_11_W2_02_repeatedCancelReturnsIdempotentTerminalResponse() throws Exception {
        when(proposalService.getProposal("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.CANCELLED));
        when(proposalService.cancel("tester", "proposal-1")).thenReturn(proposal(AiActionProposalStatus.CANCELLED));

        mockMvc
            .perform(
                post("/api/ai/proposals/proposal-1/cancel").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value(MessageCode.ERROR_BUSINESS_AI_PROPOSAL_TERMINAL.code()))
            .andExpect(jsonPath("$.decision").value("IDEMPOTENT"))
            .andExpect(jsonPath("$.terminal").value(true))
            .andExpect(jsonPath("$.proposal.status").value("CANCELLED"));
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }

    private AiActionProposalView proposal(AiActionProposalStatus status) {
        return new AiActionProposalView(
            "proposal-1",
            status,
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
            status == AiActionProposalStatus.REJECTED ? "Unsupported action" : null,
            status == AiActionProposalStatus.REJECTED ? "No executor is registered for this action type." : null
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
