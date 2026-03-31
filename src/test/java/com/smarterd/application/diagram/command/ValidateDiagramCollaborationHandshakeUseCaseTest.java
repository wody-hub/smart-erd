package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.collaboration.command.ValidateCollaborationTicketUseCase;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ValidateDiagramCollaborationHandshakeUseCaseTest {

    @Mock
    private ValidateCollaborationTicketUseCase validateCollaborationTicketUseCase;

    @Mock
    private DiagramCollaborationResourceKeyFactory diagramCollaborationResourceKeyFactory;

    @Test
    void validate_returnsSessionAndDiagramIdWhenPathAndTicketMatch() {
        final var useCase = new ValidateDiagramCollaborationHandshakeUseCase(
            validateCollaborationTicketUseCase,
            diagramCollaborationResourceKeyFactory
        );
        final var resourceKey = new CollaborationResourceKey("diagram", "42");
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "tester",
            "Tester",
            resourceKey,
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        when(diagramCollaborationResourceKeyFactory.fromWebSocketPath("/ws/diagram/42")).thenReturn(resourceKey);
        when(diagramCollaborationResourceKeyFactory.parseDiagramId(resourceKey)).thenReturn(42L);
        when(validateCollaborationTicketUseCase.validateAndConsume("ticket-1", resourceKey, 2)).thenReturn(
            Optional.of(session)
        );

        final var actual = useCase.validate("/ws/diagram/42", "ticket-1", 2);

        assertThat(actual).contains(new DiagramHandshakeValidationResult(session, 42L));
        verify(validateCollaborationTicketUseCase).validateAndConsume("ticket-1", resourceKey, 2);
    }

    @Test
    void validate_returnsEmptyWhenPathParsingFails() {
        final var useCase = new ValidateDiagramCollaborationHandshakeUseCase(
            validateCollaborationTicketUseCase,
            diagramCollaborationResourceKeyFactory
        );

        when(diagramCollaborationResourceKeyFactory.fromWebSocketPath("/ws/unknown/42")).thenThrow(
            new IllegalArgumentException("bad path")
        );

        assertThat(useCase.validate("/ws/unknown/42", "ticket-1", 1)).isEmpty();
    }
}
