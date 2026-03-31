package com.smarterd.domain.diagram.websocket.session;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import java.time.Instant;

/**
 * 다이어그램 WebSocket runtime에서 사용하는 정규화된 세션 메타데이터.
 *
 * <p>공통 협업 세션과 legacy 다이어그램 세션이 어떤 형태로 저장되었는지와 무관하게,
 * runtime은 이 타입 하나만 사용한다.</p>
 *
 * @param userId 사용자 불변 식별자
 * @param loginId 사용자 로그인 ID
 * @param userName 사용자 표시 이름
 * @param resourceKey 협업 리소스 key
 * @param diagramId 다이어그램 ID
 * @param expiresAt 세션 만료 시각
 * @param protocolVersion 클라이언트 프로토콜 버전
 */
public record DiagramWebSocketSessionInfo(
    String userId,
    String loginId,
    String userName,
    CollaborationResourceKey resourceKey,
    Long diagramId,
    Instant expiresAt,
    int protocolVersion
) {
    /**
     * 세션이 만료되었는지 확인한다.
     *
     * @return 만료 여부
     */
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
