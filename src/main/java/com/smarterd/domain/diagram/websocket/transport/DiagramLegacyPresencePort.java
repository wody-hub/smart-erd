package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.application.diagram.port.DiagramSessionRef;
import org.springframework.lang.NonNull;

/**
 * 구버전 presence 호환 브로드캐스트 포트.
 *
 * <p>legacy client peer-left 호환 제거 시 함께 삭제한다.</p>
 */
public interface DiagramLegacyPresencePort {
    void broadcastPeerLeftLegacy(@NonNull Long diagramId, @NonNull DiagramSessionRef senderSessionRef, String loginId);
}
