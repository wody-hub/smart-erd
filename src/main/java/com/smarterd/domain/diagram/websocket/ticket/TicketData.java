package com.smarterd.domain.diagram.websocket.ticket;

import java.time.Instant;

/**
 * ticket 발급 시 저장되는 데이터.
 *
 * @param userId    사용자 ID (불변 식별자)
 * @param loginId   사용자 로그인 ID
 * @param userName  사용자 표시 이름
 * @param diagramId 대상 다이어그램 ID
 * @param expiresAt ticket 만료 시각
 * @param editProtocolVersion 발급 요청의 유효 편집 프로토콜 버전
 */
public record TicketData(
    String userId,
    String loginId,
    String userName,
    Long diagramId,
    Instant expiresAt,
    int editProtocolVersion
) {
    /** 구버전 Redis JSON의 누락된 버전(0)은 레거시 v1로 해석한다. */
    public TicketData {
        editProtocolVersion = Math.max(1, editProtocolVersion);
    }
}
