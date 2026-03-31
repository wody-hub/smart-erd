package com.smarterd.application.diagram.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.application.collaboration.command.IssueCollaborationTicketUseCase;
import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IssueDiagramCollaborationTicketUseCaseTest {

    @Mock
    private IssueCollaborationTicketUseCase issueCollaborationTicketUseCase;

    @Mock
    private DiagramCollaborationResourceKeyFactory diagramCollaborationResourceKeyFactory;

    @Test
    void execute_buildsDiagramResourceKeyAndDelegates() {
        final var useCase = new IssueDiagramCollaborationTicketUseCase(
            issueCollaborationTicketUseCase,
            diagramCollaborationResourceKeyFactory
        );
        final var resourceKey = new CollaborationResourceKey("diagram", "101");
        final var result = new CollaborationTicketIssueResult("ticket-1", "user-1", 2);

        when(diagramCollaborationResourceKeyFactory.forDiagramId(101L)).thenReturn(resourceKey);
        when(issueCollaborationTicketUseCase.issueVerifiedTicket("tester", resourceKey)).thenReturn(result);

        final var actual = useCase.execute("tester", 101L);

        assertThat(actual).isEqualTo(result);
        verify(diagramCollaborationResourceKeyFactory).forDiagramId(101L);
        verify(issueCollaborationTicketUseCase).issueVerifiedTicket("tester", resourceKey);
    }
}
