package com.smarterd.collaboration.channel;

/**
 * 채널별 WebSocket ticket 발급 정책.
 */
public interface CollaborationTicketIssuer {

    /**
     * 로그인 사용자와 협업 리소스 기준으로 검증된 ticket을 발급한다.
     *
     * @param loginId     로그인 ID
     * @param resourceKey 협업 리소스 key
     * @return ticket 발급 결과
     */
    CollaborationTicketIssueResult issueVerifiedTicket(String loginId, CollaborationResourceKey resourceKey);
}
