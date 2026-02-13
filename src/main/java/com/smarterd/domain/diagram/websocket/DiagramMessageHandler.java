package com.smarterd.domain.diagram.websocket;

import java.util.Set;

/**
 * 다이어그램 WebSocket 메시지 타입별 처리기.
 *
 * <p>각 구현체는 자신이 처리할 타입 집합을 선언하고, 단일 메시지 처리 로직만 담당한다.</p>
 */
public interface DiagramMessageHandler {
    /**
     * 처리 가능한 메시지 타입 집합.
     *
     * @return 메시지 타입 집합
     */
    Set<Byte> supportedTypes();

    /**
     * 메시지 처리.
     *
     * @param context 메시지 컨텍스트
     * @throws RuntimeException 구현체 내부 처리 중 복구 불가 오류가 발생한 경우
     */
    void handle(DiagramMessageContext context);
}
