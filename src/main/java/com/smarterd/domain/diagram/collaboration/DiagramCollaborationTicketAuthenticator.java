package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationTicketAuthenticator;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.websocket.ticket.WsTicketService;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널용 WebSocket ticket 검증 정책.
 */
@Component
public class DiagramCollaborationTicketAuthenticator implements CollaborationTicketAuthenticator {

    private final WsTicketService wsTicketService;
    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * 기본 생성자.
     *
     * @param wsTicketService WebSocket ticket 서비스
     * @param resourceKeyFactory 다이어그램 resource key factory
     */
    public DiagramCollaborationTicketAuthenticator(
        WsTicketService wsTicketService,
        DiagramCollaborationResourceKeyFactory resourceKeyFactory
    ) {
        this.wsTicketService = wsTicketService;
        this.resourceKeyFactory = resourceKeyFactory;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Optional<CollaborationAuthenticatedSession> validateAndConsume(String ticket, int protocolVersion) {
        return wsTicketService
            .validateAndConsume(ticket)
            .map((session) ->
                new CollaborationAuthenticatedSession(
                    session.userId(),
                    session.loginId(),
                    session.userName(),
                    resourceKeyFactory.forDiagramId(session.diagramId()),
                    session.expiresAt(),
                    protocolVersion
                )
            );
    }
}
