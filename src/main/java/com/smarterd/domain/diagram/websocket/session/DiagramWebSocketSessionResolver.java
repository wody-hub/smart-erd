package com.smarterd.domain.diagram.websocket.session;

import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationSessionMetadataPolicy;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 WebSocket runtime에서 사용할 세션 메타데이터 resolver.
 *
 * <p>공통 협업 세션 메타데이터만 authoritative path로 사용한다.</p>
 */
@Component
public class DiagramWebSocketSessionResolver {

    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;
    private final DiagramCollaborationSessionMetadataPolicy sessionMetadataPolicy;

    /**
     * 기본 생성자.
     *
     * @param resourceKeyFactory 다이어그램 resource key factory
     * @param sessionMetadataPolicy 다이어그램 세션 메타데이터 정책
     */
    public DiagramWebSocketSessionResolver(
        DiagramCollaborationResourceKeyFactory resourceKeyFactory,
        DiagramCollaborationSessionMetadataPolicy sessionMetadataPolicy
    ) {
        this.resourceKeyFactory = resourceKeyFactory;
        this.sessionMetadataPolicy = sessionMetadataPolicy;
    }

    /**
     * WebSocket 세션 attributes에서 다이어그램 세션 메타데이터를 해석한다.
     *
     * @param session WebSocket 세션
     * @return 다이어그램 세션 메타데이터. 없거나 해석 불가하면 {@code null}
     */
    @Nullable
    public DiagramWebSocketSessionInfo resolve(WebSocketSession session) {
        final var commonValue = session.getAttributes().get(CollaborationAuthenticatedSession.SESSION_ATTR_KEY);
        if (commonValue instanceof CollaborationAuthenticatedSession info) {
            try {
                sessionMetadataPolicy.validateAccess(info);
                return new DiagramWebSocketSessionInfo(
                    info.userId(),
                    info.loginId(),
                    info.userName(),
                    info.resourceKey(),
                    resourceKeyFactory.parseDiagramId(info.resourceKey()),
                    info.expiresAt(),
                    info.protocolVersion()
                );
            } catch (IllegalArgumentException e) {
                return null;
            }
        }

        return null;
    }
}
