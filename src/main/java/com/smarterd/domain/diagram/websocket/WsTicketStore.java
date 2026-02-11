package com.smarterd.domain.diagram.websocket;

import java.time.Duration;
import java.util.Optional;

/**
 * WebSocket ticket 저장소 인터페이스.
 *
 * <p>Strategy Pattern으로 in-memory / Redis 구현체를 교체할 수 있다.</p>
 */
public interface WsTicketStore {
    /**
     * ticket을 저장한다.
     *
     * @param ticket 티켓 문자열
     * @param data   티켓 데이터
     * @param ttl    유효 기간
     */
    void store(String ticket, TicketData data, Duration ttl);

    /**
     * ticket을 소멸(consume)하고 데이터를 반환한다.
     *
     * <p>ticket이 존재하면 즉시 삭제하여 재사용을 방지한다.</p>
     *
     * @param ticket 소멸할 티켓 문자열
     * @return 티켓 데이터 (없거나 만료 시 empty)
     */
    Optional<TicketData> consume(String ticket);

    /**
     * 특정 사용자/다이어그램 조합의 기존 ticket을 제거한다.
     *
     * @param loginId   사용자 로그인 ID
     * @param diagramId 다이어그램 ID
     */
    void removeByLoginIdAndDiagramId(String loginId, Long diagramId);

    /**
     * 특정 사용자의 미사용 ticket 수를 반환한다.
     *
     * @param loginId 사용자 로그인 ID
     * @return 미사용 ticket 수
     */
    long countByLoginId(String loginId);
}
