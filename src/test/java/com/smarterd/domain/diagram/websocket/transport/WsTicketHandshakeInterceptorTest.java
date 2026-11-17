package com.smarterd.domain.diagram.websocket.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.command.DiagramHandshakeValidationResult;
import com.smarterd.application.diagram.command.ValidateDiagramCollaborationHandshakeUseCase;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

@ExtendWith(MockitoExtension.class)
class WsTicketHandshakeInterceptorTest {

    @Mock
    private ValidateDiagramCollaborationHandshakeUseCase validateDiagramCollaborationHandshakeUseCase;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private WebSocketHandler webSocketHandler;

    @ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({ "1,1", "1,2", "1,3", "3,3" })
    void beforeHandshake_storesCommonSessionAttributesOnSuccess(int minimum, int protocolVersion) {
        final var properties = new com.smarterd.config.websocket.CollaborationProperties();
        properties.setMinEditProtocolVersion(minimum);
        final var interceptor = new WsTicketHandshakeInterceptor(
            new com.smarterd.collaboration.CollaborationProtocolPolicy(properties),
            validateDiagramCollaborationHandshakeUseCase
        );
        final var attributes = new HashMap<String, Object>();
        final var resourceKey = new com.smarterd.collaboration.channel.CollaborationResourceKey("diagram", "42");
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "tester",
            "Tester",
            resourceKey,
            Instant.parse("2026-03-23T00:00:00Z"),
            protocolVersion
        );

        when(request.getURI()).thenReturn(
            URI.create("/ws/diagram/42?ticket=ticket-1&protocolVersion=" + protocolVersion)
        );
        when(
            validateDiagramCollaborationHandshakeUseCase.validate("/ws/diagram/42", "ticket-1", protocolVersion)
        ).thenReturn(Optional.of(new DiagramHandshakeValidationResult(session, 42L)));

        final var accepted = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(accepted).isTrue();
        assertThat(
            attributes.get(com.smarterd.collaboration.session.CollaborationAuthenticatedSession.SESSION_ATTR_KEY)
        ).isEqualTo(session);
        assertThat(attributes).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(
        strings = { "", "&protocolVersion=1", "&protocolVersion=2", "&protocolVersion=4", "&protocolVersion=invalid" }
    )
    void oldNegotiatedProtocolIsMarkedForExplicitPolicyClose(String query) {
        final var properties = new com.smarterd.config.websocket.CollaborationProperties();
        properties.setMinEditProtocolVersion(3);
        final var policy = new com.smarterd.collaboration.CollaborationProtocolPolicy(properties);
        final var interceptor = new WsTicketHandshakeInterceptor(policy, validateDiagramCollaborationHandshakeUseCase);
        final var version = query.endsWith("=2") ? 2 : 1;
        final var session = new CollaborationAuthenticatedSession(
            "user",
            "tester",
            "Tester",
            new com.smarterd.collaboration.channel.CollaborationResourceKey("diagram", "42"),
            Instant.now().plusSeconds(60),
            version
        );
        when(request.getURI()).thenReturn(URI.create("/ws/diagram/42?ticket=ticket-1" + query));
        when(validateDiagramCollaborationHandshakeUseCase.validate("/ws/diagram/42", "ticket-1", version)).thenReturn(
            Optional.of(new DiagramHandshakeValidationResult(session, 42L))
        );
        final var attributes = new HashMap<String, Object>();
        assertThat(interceptor.beforeHandshake(request, response, webSocketHandler, attributes)).isTrue();
        assertThat(attributes).containsEntry("protocol-too-old", Boolean.TRUE);
    }

    @Test
    void beforeHandshake_rejectsWhenTicketValidationFails() {
        final var interceptor = new WsTicketHandshakeInterceptor(
            new com.smarterd.collaboration.CollaborationProtocolPolicy(
                new com.smarterd.config.websocket.CollaborationProperties()
            ),
            validateDiagramCollaborationHandshakeUseCase
        );
        final var attributes = new HashMap<String, Object>();

        when(request.getURI()).thenReturn(URI.create("/ws/diagram/42?ticket=ticket-1"));
        when(validateDiagramCollaborationHandshakeUseCase.validate("/ws/diagram/42", "ticket-1", 1)).thenReturn(
            Optional.empty()
        );

        final var accepted = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(accepted).isFalse();
        assertThat(attributes).isEmpty();
        verify(validateDiagramCollaborationHandshakeUseCase).validate("/ws/diagram/42", "ticket-1", 1);
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }
}
