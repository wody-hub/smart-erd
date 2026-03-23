package com.smarterd.application.collaboration.command;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.collaboration.channel.CollaborationTicketSupportRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 채널 ticket support 기준으로 검증된 협업 ticket을 발급하는 유스케이스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IssueCollaborationTicketUseCase {

    private final CollaborationTicketSupportRegistry collaborationTicketSupportRegistry;

    /**
     * 협업 리소스에 대한 WebSocket ticket을 발급한다.
     *
     * @param loginId     로그인 ID
     * @param resourceKey 협업 리소스 key
     * @return ticket 발급 결과
     */
    public CollaborationTicketIssueResult issueVerifiedTicket(String loginId, CollaborationResourceKey resourceKey) {
        final var ticketSupport = collaborationTicketSupportRegistry.getRequired(resourceKey);
        return ticketSupport.ticketIssuer().issueVerifiedTicket(loginId, resourceKey);
    }
}
