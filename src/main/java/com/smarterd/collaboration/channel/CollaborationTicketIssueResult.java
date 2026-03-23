package com.smarterd.collaboration.channel;

/**
 * 협업 채널 ticket 발급 결과.
 *
 * @param ticket                  발급된 일회용 ticket
 * @param userId                  사용자 ID
 * @param presenceProtocolVersion presence 프로토콜 버전
 */
public record CollaborationTicketIssueResult(
    String ticket,
    String userId,
    int presenceProtocolVersion
) {}
