package com.smarterd.domain.diagram.websocket.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class AuthenticatedSessionTest {

    @Test
    void toAndFromCollaborationSession_shouldRoundTripDiagramSession() {
        final var session = new AuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            42L,
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        final var collaborationSession = session.toCollaborationSession();

        assertThat(collaborationSession.resourceKey()).isEqualTo(new CollaborationResourceKey("diagram", "42"));
        assertThat(AuthenticatedSession.fromCollaborationSession(collaborationSession)).isEqualTo(session);
    }

    @Test
    void fromCollaborationSession_shouldRejectNonDiagramChannel() {
        final var collaborationSession = new CollaborationAuthenticatedSession(
            "user-1",
            "login-1",
            "Tester",
            new CollaborationResourceKey("board", "42"),
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        assertThatThrownBy(() -> AuthenticatedSession.fromCollaborationSession(collaborationSession))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("board");
    }
}
