package com.smarterd.domain.diagram.websocket.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationSessionMetadataPolicy;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

class DiagramWebSocketSessionResolverTest {

    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory =
        new DiagramCollaborationResourceKeyFactory();

    @Test
    void resolve_shouldPreferCommonCollaborationSessionWhenAvailable() {
        final var resolver = new DiagramWebSocketSessionResolver(
            resourceKeyFactory,
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory)
        );
        final var session = mock(WebSocketSession.class);
        final var common = new CollaborationAuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            resourceKeyFactory.forDiagramId(42L),
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        when(session.getAttributes()).thenReturn(Map.of(CollaborationAuthenticatedSession.SESSION_ATTR_KEY, common));

        assertThat(resolver.resolve(session)).isEqualTo(
            new DiagramWebSocketSessionInfo(
                common.userId(),
                common.loginId(),
                common.userName(),
                common.resourceKey(),
                42L,
                common.expiresAt(),
                common.protocolVersion()
            )
        );
    }

    @Test
    void resolve_shouldReturnNullWhenCommonSessionIsMissing() {
        final var resolver = new DiagramWebSocketSessionResolver(
            resourceKeyFactory,
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory)
        );
        final var session = mock(WebSocketSession.class);
        when(session.getAttributes()).thenReturn(Map.of());

        assertThat(resolver.resolve(session)).isNull();
    }

    @Test
    void resolve_shouldReturnNullWhenCommonSessionFailsValidation() {
        final var resolver = new DiagramWebSocketSessionResolver(
            resourceKeyFactory,
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory)
        );
        final var session = mock(WebSocketSession.class);
        final var invalidCommon = new CollaborationAuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            new CollaborationResourceKey("board", "42"),
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );
        when(session.getAttributes()).thenReturn(
            Map.of(CollaborationAuthenticatedSession.SESSION_ATTR_KEY, invalidCommon)
        );

        assertThat(resolver.resolve(session)).isNull();
    }
}
