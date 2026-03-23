package com.smarterd.domain.diagram.websocket.session;

import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationSessionMetadataPolicy;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 WebSocket runtime에서 사용할 세션 메타데이터 resolver.
 *
 * <p>공통 협업 세션 메타데이터를 우선 사용하고, 과도기 호환을 위해 legacy 다이어그램 세션 메타데이터를
 * fallback으로 허용한다.</p>
 */
@Component
public class DiagramWebSocketSessionResolver {

    private final DiagramCollaborationSessionMetadataPolicy sessionMetadataPolicy;

    /**
     * 기본 생성자.
     *
     * @param sessionMetadataPolicy 다이어그램 세션 메타데이터 정책
     */
    public DiagramWebSocketSessionResolver(
        DiagramCollaborationSessionMetadataPolicy sessionMetadataPolicy
    ) {
        this.sessionMetadataPolicy = sessionMetadataPolicy;
    }

    /**
     * WebSocket 세션 attributes에서 다이어그램 세션 메타데이터를 해석한다.
     *
     * @param session WebSocket 세션
     * @return 다이어그램 세션 메타데이터. 없거나 해석 불가하면 {@code null}
     */
    @Nullable
    public AuthenticatedSession resolve(WebSocketSession session) {
        final var commonValue = session.getAttributes().get(CollaborationAuthenticatedSession.SESSION_ATTR_KEY);
        if (commonValue instanceof CollaborationAuthenticatedSession info) {
            try {
                sessionMetadataPolicy.validateAccess(info);
                return AuthenticatedSession.fromCollaborationSession(info);
            } catch (IllegalArgumentException e) {
                // 아래 legacy fallback으로 계속 진행한다.
            }
        }

        final var legacyValue = session.getAttributes().get(AuthenticatedSession.SESSION_ATTR_KEY);
        if (legacyValue instanceof AuthenticatedSession info) {
            return info;
        }

        return null;
    }
}
