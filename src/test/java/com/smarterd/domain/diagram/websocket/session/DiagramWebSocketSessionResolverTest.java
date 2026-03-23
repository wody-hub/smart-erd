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
        final var legacy = new AuthenticatedSession(
            "legacy-user",
            "legacy-login",
            "Legacy",
            99L,
            Instant.parse("2026-03-23T00:00:00Z"),
            1
        );

        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                common,
                AuthenticatedSession.SESSION_ATTR_KEY,
                legacy
            )
        );

        assertThat(resolver.resolve(session)).isEqualTo(AuthenticatedSession.fromCollaborationSession(common));
    }

    @Test
    void resolve_shouldFallbackToLegacySessionWhenCommonSessionIsMissing() {
        final var resolver = new DiagramWebSocketSessionResolver(
            new DiagramCollaborationSessionMetadataPolicy(resourceKeyFactory)
        );
        final var session = mock(WebSocketSession.class);
        final var legacy = new AuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            42L,
            Instant.parse("2026-03-23T00:00:00Z"),
            1
        );

        when(session.getAttributes()).thenReturn(Map.of(AuthenticatedSession.SESSION_ATTR_KEY, legacy));

        assertThat(resolver.resolve(session)).isEqualTo(legacy);
    }

    @Test
    void resolve_shouldFallbackToLegacySessionWhenCommonSessionFailsValidation() {
        final var resolver = new DiagramWebSocketSessionResolver(
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
        final var legacy = new AuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            42L,
            Instant.parse("2026-03-23T00:00:00Z"),
            1
        );

        when(session.getAttributes()).thenReturn(
            Map.of(
                CollaborationAuthenticatedSession.SESSION_ATTR_KEY,
                invalidCommon,
                AuthenticatedSession.SESSION_ATTR_KEY,
                legacy
            )
        );

        assertThat(resolver.resolve(session)).isEqualTo(legacy);
    }
}
