package com.smarterd.api.diagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.api.diagram.dto.WsTicketRequest;
import com.smarterd.application.diagram.command.IssueDiagramCollaborationTicketUseCase;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class WsTicketControllerTest {

    @Mock
    private IssueDiagramCollaborationTicketUseCase issueDiagramCollaborationTicketUseCase;

    @Test
    void issueTicket_delegatesToCollaborationUseCase() {
        final var controller = new WsTicketController(issueDiagramCollaborationTicketUseCase);
        final var jwt = jwt("tester");
        final var request = new WsTicketRequest(100L);
        final var result = new CollaborationTicketIssueResult("ticket-1", "user-1", 1);

        when(issueDiagramCollaborationTicketUseCase.execute("tester", 100L)).thenReturn(result);

        final var response = controller.issueTicket(jwt, request);

        assertThat(response.ticket()).isEqualTo("ticket-1");
        assertThat(response.userId()).isEqualTo("user-1");
        assertThat(response.presenceProtocolVersion()).isEqualTo(1);
        verify(issueDiagramCollaborationTicketUseCase).execute("tester", 100L);
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }
}
