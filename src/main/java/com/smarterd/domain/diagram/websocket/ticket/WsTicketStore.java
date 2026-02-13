package com.smarterd.domain.diagram.websocket.ticket;

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
     * 기존 (loginId, diagramId) ticket을 대체하면서 사용자별 미사용 ticket 상한을 원자적으로 검사한다.
     *
     * <p>수평 확장 환경에서도 발급 상한이 깨지지 않도록 저장소 구현체가 단일 원자 연산으로 처리해야 한다.</p>
     *
     * @param ticket         신규 티켓 문자열
     * @param data           티켓 데이터
     * @param ttl            유효 기간
     * @param maxOutstanding 사용자당 최대 미사용 티켓 수
     * @return 발급 성공 여부 (상한 초과 시 false)
     */
    boolean issueTicketAtomically(String ticket, TicketData data, Duration ttl, int maxOutstanding);

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
