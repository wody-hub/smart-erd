package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationTicketAuthenticator;
import com.smarterd.collaboration.channel.CollaborationTicketIssuer;
import com.smarterd.collaboration.channel.CollaborationTicketSupport;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널의 ticket 정책 묶음.
 */
@Component
public class DiagramCollaborationTicketSupport implements CollaborationTicketSupport {

    private final CollaborationTicketIssuer ticketIssuer;
    private final CollaborationTicketAuthenticator ticketAuthenticator;

    /**
     * 기본 생성자.
     *
     * @param ticketIssuer 다이어그램 채널 ticket 발급 정책
     * @param ticketAuthenticator 다이어그램 채널 ticket 검증 정책
     */
    public DiagramCollaborationTicketSupport(
        DiagramCollaborationTicketIssuer ticketIssuer,
        DiagramCollaborationTicketAuthenticator ticketAuthenticator
    ) {
        this.ticketIssuer = ticketIssuer;
        this.ticketAuthenticator = ticketAuthenticator;
    }

    @Override
    public String channelType() {
        return DiagramCollaborationResourceKeyFactory.CHANNEL_TYPE;
    }

    @Override
    public CollaborationTicketIssuer ticketIssuer() {
        return ticketIssuer;
    }

    @Override
    public CollaborationTicketAuthenticator ticketAuthenticator() {
        return ticketAuthenticator;
    }
}
