package com.smarterd.application.collaboration.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.collaboration.channel.CollaborationTicketIssuer;
import com.smarterd.collaboration.channel.CollaborationTicketSupport;
import com.smarterd.collaboration.channel.CollaborationTicketSupportRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IssueCollaborationTicketUseCaseTest {

    @Mock
    private CollaborationTicketSupportRegistry collaborationTicketSupportRegistry;

    @Mock
    private CollaborationTicketSupport collaborationTicketSupport;

    @Mock
    private CollaborationTicketIssuer collaborationTicketIssuer;

    @Test
    void issueVerifiedTicket_delegatesToChannelTicketIssuer() {
        final var useCase = new IssueCollaborationTicketUseCase(collaborationTicketSupportRegistry);
        final var resourceKey = new CollaborationResourceKey("diagram", "100");
        final var expected = new CollaborationTicketIssueResult("ticket-1", "user-1", 1);

        when(collaborationTicketSupportRegistry.getRequired(resourceKey)).thenReturn(collaborationTicketSupport);
        when(collaborationTicketSupport.ticketIssuer()).thenReturn(collaborationTicketIssuer);
        when(collaborationTicketIssuer.issueVerifiedTicket("tester", resourceKey)).thenReturn(expected);

        assertThat(useCase.issueVerifiedTicket("tester", resourceKey)).isEqualTo(expected);
    }
}
