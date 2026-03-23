package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.collaboration.channel.CollaborationTicketIssuer;
import com.smarterd.domain.diagram.websocket.ticket.WsTicketService;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널용 WebSocket ticket 발급 정책.
 */
@Component
public class DiagramCollaborationTicketIssuer implements CollaborationTicketIssuer {

    private final WsTicketService wsTicketService;
    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * 기본 생성자.
     *
     * @param wsTicketService     WebSocket ticket 서비스
     * @param resourceKeyFactory 다이어그램 resource key factory
     */
    public DiagramCollaborationTicketIssuer(
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
    public CollaborationTicketIssueResult issueVerifiedTicket(String loginId, CollaborationResourceKey resourceKey) {
        final var result = wsTicketService.issueVerifiedTicket(loginId, resourceKeyFactory.parseDiagramId(resourceKey));
        return new CollaborationTicketIssueResult(
            result.ticket(),
            result.userId(),
            result.presenceProtocolVersion()
        );
    }
}
