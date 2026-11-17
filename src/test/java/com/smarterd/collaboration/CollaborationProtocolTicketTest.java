package com.smarterd.collaboration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.smarterd.application.diagram.command.DiagramHandshakeValidationResult;
import com.smarterd.application.diagram.command.ValidateDiagramCollaborationHandshakeUseCase;
import com.smarterd.config.websocket.CollaborationProperties;
import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationTicketAuthenticator;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.ticket.InMemoryWsTicketStore;
import com.smarterd.domain.diagram.websocket.ticket.WsTicketService;
import com.smarterd.domain.diagram.websocket.transport.DiagramInboundMessageContextFactory;
import com.smarterd.domain.diagram.websocket.transport.DiagramWebSocketHandler;
import com.smarterd.domain.diagram.websocket.transport.DiagramWebSocketMessageDispatcher;
import com.smarterd.domain.diagram.websocket.transport.DiagramWebSocketSessionLifecycle;
import com.smarterd.domain.diagram.websocket.transport.WsTicketHandshakeInterceptor;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.net.URI;
import java.util.HashMap;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

class CollaborationProtocolTicketTest {

    @ParameterizedTest
    @CsvSource({ "1,1,true", "1,3,true", "3,1,true", "3,3,false" })
    void policyFlipChecksIssuedRestAndNegotiatedWsVersionsBeforeRoomEntry(
        int restVersion,
        int wsVersion,
        boolean blocked
    ) throws Exception {
        final var properties = new CollaborationProperties();
        final var policy = new CollaborationProtocolPolicy(properties);
        final var users = mock(UserRepository.class);
        final var diagrams = mock(DiagramRepository.class);
        final var members = mock(TeamMemberRepository.class);
        final var user = mock(User.class);
        final var diagram = mock(Diagram.class);
        final var project = mock(Project.class);
        final var team = mock(Team.class);
        when(users.findByLoginId("tester")).thenReturn(Optional.of(user));
        when(diagrams.findByIdWithProjectAndTeam(42L)).thenReturn(Optional.of(diagram));
        when(diagram.getProject()).thenReturn(project);
        when(project.getTeam()).thenReturn(team);
        when(members.existsByTeamAndUser(team, user)).thenReturn(true);
        when(user.getId()).thenReturn(1L);
        when(user.getName()).thenReturn("Tester");
        final var store = new InMemoryWsTicketStore();
        final var service = new WsTicketService(new WebSocketProperties(), users, diagrams, members, store, policy);
        final var issued = service.issueVerifiedTicket("tester", 42L, restVersion);
        // Redis 직렬화 왕복은 RedisWsTicketStoreTest에서 별도로 검증한다.
        properties.setMinEditProtocolVersion(3);
        final var authenticator = new DiagramCollaborationTicketAuthenticator(
            service,
            new DiagramCollaborationResourceKeyFactory()
        );
        final var validation = mock(ValidateDiagramCollaborationHandshakeUseCase.class);
        when(validation.validate(anyString(), anyString(), anyInt())).thenAnswer((invocation) ->
            authenticator
                .validateAndConsume(invocation.getArgument(1), invocation.getArgument(2))
                .map((session) -> new DiagramHandshakeValidationResult(session, 42L))
        );
        final var interceptor = new WsTicketHandshakeInterceptor(policy, validation);
        final var request = mock(ServerHttpRequest.class);
        final var response = mock(ServerHttpResponse.class);
        when(request.getURI()).thenReturn(
            URI.create("/ws/diagram/42?ticket=" + issued.ticket() + "&protocolVersion=" + wsVersion)
        );
        final var attributes = new HashMap<String, Object>();
        final var context = mock(DiagramInboundMessageContextFactory.class);
        final var lifecycle = mock(DiagramWebSocketSessionLifecycle.class);
        final var dispatcher = mock(DiagramWebSocketMessageDispatcher.class);
        final var handler = new DiagramWebSocketHandler(new WebSocketProperties(), context, lifecycle, dispatcher);
        assertThat(interceptor.beforeHandshake(request, response, handler, attributes)).isTrue();
        assertThat(Boolean.TRUE.equals(attributes.get(CollaborationProtocolPolicy.PROTOCOL_TOO_OLD))).isEqualTo(
            blocked
        );
        assertThat(store.consume(issued.ticket())).isEmpty();
        if (blocked) {
            final var session = mock(WebSocketSession.class);
            when(session.getAttributes()).thenReturn(attributes);
            handler.afterConnectionEstablished(session);
            handler.afterConnectionClosed(session, CloseStatus.POLICY_VIOLATION);
            verify(session).close(CloseStatus.POLICY_VIOLATION.withReason("protocol-too-old"));
            verifyNoInteractions(context, lifecycle, dispatcher);
        }
    }
}
