package com.smarterd.collaboration;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.api.diagram.DiagramContentController;
import com.smarterd.api.diagram.WsTicketController;
import com.smarterd.application.diagram.command.IssueDiagramCollaborationTicketUseCase;
import com.smarterd.application.diagram.command.PersistDiagramSnapshotUseCase;
import com.smarterd.application.diagram.command.SaveDiagramUseCase;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.config.websocket.CollaborationProperties;
import com.smarterd.config.websocket.CollaborationProtocolConfig;
import com.smarterd.domain.diagram.service.SaveDiagramResult;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

class CollaborationProtocolRestTest {

    private static final String DOCUMENT = "/api/teams/1/projects/2/diagrams/3";
    private final SaveDiagramUseCase save = mock(SaveDiagramUseCase.class);
    private final PersistDiagramSnapshotUseCase snapshot = mock(PersistDiagramSnapshotUseCase.class);
    private final IssueDiagramCollaborationTicketUseCase ticket = mock(IssueDiagramCollaborationTicketUseCase.class);
    private final CollaborationProperties properties = new CollaborationProperties();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        properties.setMinEditProtocolVersion(3);
        final var registry = mock(InterceptorRegistry.class);
        new CollaborationProtocolConfig(new CollaborationProtocolPolicy(properties)).addInterceptors(registry);
        final var interceptor = ArgumentCaptor.forClass(HandlerInterceptor.class);
        verify(registry).addInterceptor(interceptor.capture());
        final var messages = new ResourceBundleMessageSource();
        messages.setBasename("i18n/messages");
        messages.setDefaultEncoding("UTF-8");
        messages.setFallbackToSystemLocale(false);
        mvc = MockMvcBuilders.standaloneSetup(
            new DiagramContentController(save, snapshot),
            new WsTicketController(ticket),
            new ReadController()
        )
            .setControllerAdvice(new GlobalExceptionHandler(messages))
            .addInterceptors(interceptor.getValue())
            .setCustomArgumentResolvers(
                new HandlerMethodArgumentResolver() {
                    @Override
                    public boolean supportsParameter(MethodParameter parameter) {
                        return parameter.getParameterType() == Jwt.class;
                    }

                    @Override
                    public Object resolveArgument(
                        MethodParameter parameter,
                        ModelAndViewContainer container,
                        NativeWebRequest request,
                        WebDataBinderFactory binderFactory
                    ) {
                        return Jwt.withTokenValue("token").header("alg", "none").subject("tester").build();
                    }
                }
            )
            .build();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "1", "2", "invalid", "999999999999999999" })
    void oldOrMissingVersionRejectsAllDocumentWritesAndTicketBeforeMutation(String version) throws Exception {
        final var contentRequest = put(DOCUMENT)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"{}\"}");
        final var snapshotRequest = post(DOCUMENT + "/ydoc-snapshot")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedContentRevision\":\"1\",\"ydocSnapshot\":\"AQ==\"}");
        final var ticketRequest = post("/api/ws-ticket")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"diagramId\":3}");
        for (final var request : java.util.List.of(contentRequest, snapshotRequest, ticketRequest)) {
            if (version != null) request.header(CollaborationProtocolPolicy.CLIENT_PROTOCOL_HEADER, version);
            mvc
                .perform(request.header("Accept-Language", "en").locale(java.util.Locale.ENGLISH))
                .andExpect(status().is(426))
                .andExpect(jsonPath("$.error").value("App update required. Reload the page to continue editing."));
        }
        verifyNoInteractions(save, snapshot, ticket);
    }

    @Test
    void newVersionAllowsBothWritesAndTicketAndGetNeedsNoVersion() throws Exception {
        when(save.execute(anyString(), anyLong(), anyLong(), anyLong(), anyString(), any())).thenReturn(
            new SaveDiagramResult(1L, false, null, null, Instant.now())
        );
        when(
            snapshot.execute(anyString(), anyLong(), anyLong(), anyLong(), anyString(), any(), anyBoolean())
        ).thenReturn(true);
        when(ticket.execute("tester", 3L)).thenReturn(new CollaborationTicketIssueResult("ticket", "user", 1));
        mvc
            .perform(
                put(DOCUMENT)
                    .header(CollaborationProtocolPolicy.CLIENT_PROTOCOL_HEADER, "3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"{}\"}")
            )
            .andExpect(status().isOk());
        mvc
            .perform(
                post(DOCUMENT + "/ydoc-snapshot")
                    .header(CollaborationProtocolPolicy.CLIENT_PROTOCOL_HEADER, "3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"expectedContentRevision\":\"1\",\"ydocSnapshot\":\"AQ==\"}")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.persisted").value(true));
        mvc
            .perform(
                post("/api/ws-ticket")
                    .header(CollaborationProtocolPolicy.CLIENT_PROTOCOL_HEADER, "3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"diagramId\":3}")
            )
            .andExpect(status().isOk());
        mvc.perform(get(DOCUMENT)).andExpect(status().isOk());
    }

    @Test
    void defaultMinimumAllowsHeaderlessLegacyWriteAndKoreanErrorIsLocalized() throws Exception {
        mvc
            .perform(
                put(DOCUMENT)
                    .header("Accept-Language", "ko")
                    .locale(java.util.Locale.KOREAN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"{}\"}")
            )
            .andExpect(status().is(426))
            .andExpect(jsonPath("$.error").value("앱 업데이트가 필요합니다. 페이지를 새로고침한 뒤 편집하세요."));
        properties.setMinEditProtocolVersion(1);
        when(save.execute(anyString(), anyLong(), anyLong(), anyLong(), anyString(), any())).thenReturn(
            new SaveDiagramResult(1L, false, null, null, Instant.now())
        );
        mvc
            .perform(put(DOCUMENT).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"{}\"}"))
            .andExpect(status().isOk());
    }

    @RestController
    @com.smarterd.api.common.RequiresEditProtocol
    static class ReadController {

        @GetMapping(DOCUMENT)
        String read() {
            return "preview";
        }
    }
}
