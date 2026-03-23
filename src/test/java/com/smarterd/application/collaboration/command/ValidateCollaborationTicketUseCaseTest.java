package com.smarterd.application.collaboration.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationAccessPolicy;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupport;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupportRegistry;
import com.smarterd.collaboration.channel.CollaborationTicketAuthenticator;
import com.smarterd.collaboration.channel.CollaborationTicketSupport;
import com.smarterd.collaboration.channel.CollaborationTicketSupportRegistry;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ValidateCollaborationTicketUseCaseTest {

    @Mock
    private CollaborationTicketSupportRegistry collaborationTicketSupportRegistry;

    @Mock
    private CollaborationTicketSupport collaborationTicketSupport;

    @Mock
    private CollaborationRuntimeSupportRegistry collaborationRuntimeSupportRegistry;

    @Mock
    private CollaborationRuntimeSupport collaborationRuntimeSupport;

    @Mock
    private CollaborationTicketAuthenticator collaborationTicketAuthenticator;

    @Mock
    private CollaborationAccessPolicy collaborationAccessPolicy;

    @Test
    void validateAndConsume_returnsSessionWhenTicketAndResourceKeyMatch() {
        final var useCase = new ValidateCollaborationTicketUseCase(
            collaborationTicketSupportRegistry,
            collaborationRuntimeSupportRegistry
        );
        final var resourceKey = new CollaborationResourceKey("diagram", "100");
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "tester",
            "Tester",
            resourceKey,
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        when(collaborationTicketSupportRegistry.getRequired(resourceKey)).thenReturn(collaborationTicketSupport);
        when(collaborationRuntimeSupportRegistry.getRequired(resourceKey)).thenReturn(collaborationRuntimeSupport);
        when(collaborationTicketSupport.ticketAuthenticator()).thenReturn(collaborationTicketAuthenticator);
        when(collaborationRuntimeSupport.accessPolicy()).thenReturn(collaborationAccessPolicy);
        when(collaborationTicketAuthenticator.validateAndConsume("ticket-1", 2)).thenReturn(Optional.of(session));

        assertThat(useCase.validateAndConsume("ticket-1", resourceKey, 2)).contains(session);
        verify(collaborationAccessPolicy).validateAccess(session);
    }

    @Test
    void validateAndConsume_returnsEmptyWhenResourceKeyDoesNotMatch() {
        final var useCase = new ValidateCollaborationTicketUseCase(
            collaborationTicketSupportRegistry,
            collaborationRuntimeSupportRegistry
        );
        final var requested = new CollaborationResourceKey("diagram", "100");
        final var actual = new CollaborationResourceKey("diagram", "101");
        final var session = new CollaborationAuthenticatedSession(
            "user-1",
            "tester",
            "Tester",
            actual,
            Instant.parse("2026-03-23T00:00:00Z"),
            2
        );

        when(collaborationTicketSupportRegistry.getRequired(requested)).thenReturn(collaborationTicketSupport);
        when(collaborationRuntimeSupportRegistry.getRequired(requested)).thenReturn(collaborationRuntimeSupport);
        when(collaborationTicketSupport.ticketAuthenticator()).thenReturn(collaborationTicketAuthenticator);
        when(collaborationRuntimeSupport.accessPolicy()).thenReturn(collaborationAccessPolicy);
        when(collaborationTicketAuthenticator.validateAndConsume("ticket-1", 2)).thenReturn(Optional.of(session));

        assertThat(useCase.validateAndConsume("ticket-1", requested, 2)).isEmpty();
        verify(collaborationAccessPolicy).validateAccess(session);
    }
}
