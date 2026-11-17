package com.smarterd.api.diagram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.api.diagram.dto.WsTicketRequest;
import com.smarterd.application.diagram.command.IssueDiagramCollaborationTicketUseCase;
import com.smarterd.collaboration.CollaborationProtocolPolicy;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.config.websocket.CollaborationProperties;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class WsTicketControllerTest {

    @Mock
    private IssueDiagramCollaborationTicketUseCase issueDiagramCollaborationTicketUseCase;

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "1", "2", "3", "invalid" })
    void issueTicket_delegatesToCollaborationUseCase(String header) {
        final var controller = new WsTicketController(
            issueDiagramCollaborationTicketUseCase,
            new CollaborationProtocolPolicy(new CollaborationProperties())
        );
        final var jwt = jwt("tester");
        final var request = new WsTicketRequest(100L);
        final var result = new CollaborationTicketIssueResult("ticket-1", "user-1", 1);

        final var expectedVersion = "3".equals(header) ? 3 : "2".equals(header) ? 2 : 1;
        when(issueDiagramCollaborationTicketUseCase.execute("tester", 100L, expectedVersion)).thenReturn(result);

        final var response = controller.issueTicket(jwt, request, header);

        assertThat(response.ticket()).isEqualTo("ticket-1");
        assertThat(response.userId()).isEqualTo("user-1");
        assertThat(response.presenceProtocolVersion()).isEqualTo(1);
        verify(issueDiagramCollaborationTicketUseCase).execute("tester", 100L, expectedVersion);
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }
}
