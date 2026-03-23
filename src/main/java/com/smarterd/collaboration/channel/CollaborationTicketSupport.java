package com.smarterd.collaboration.channel;

/**
 * 채널 ticket 발급/검증 정책 묶음.
 */
public interface CollaborationTicketSupport {

    /**
     * 지원하는 채널 타입을 반환한다.
     *
     * @return 채널 타입
     */
    String channelType();

    /**
     * 채널 ticket 발급 정책을 반환한다.
     *
     * @return ticket 발급 정책
     */
    CollaborationTicketIssuer ticketIssuer();

    /**
     * 채널 ticket 검증/소멸 정책을 반환한다.
     *
     * @return ticket 검증 정책
     */
    CollaborationTicketAuthenticator ticketAuthenticator();
}
