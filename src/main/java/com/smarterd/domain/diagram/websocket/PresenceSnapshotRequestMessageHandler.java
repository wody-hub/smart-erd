package com.smarterd.domain.diagram.websocket;

import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * presence snapshot 재요청 처리기.
 *
 * <p>요청 빈도를 제한하고 허용된 요청에 대해 최신 presence snapshot을 해당 세션으로 전송한다.</p>
 */
@Component
@RequiredArgsConstructor
public class PresenceSnapshotRequestMessageHandler implements DiagramMessageHandler {

    private static final Logger log = LoggerFactory.getLogger(PresenceSnapshotRequestMessageHandler.class);

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT_REQUEST);

    private final DiagramRoomManager roomManager;
    private final DiagramPresenceNotifier presenceNotifier;

    /**
     * {@inheritDoc}
     */
    @Override
    public Set<Byte> supportedTypes() {
        return SUPPORTED_TYPES;
    }

    /**
     * presence snapshot 재요청을 rate limit 검사 후 처리한다.
     *
     * @param context 메시지 컨텍스트
     */
    @Override
    public void handle(DiagramMessageContext context) {
        if (!roomManager.allowPresenceSnapshotRequest(context.session())) {
            log.warn("Presence snapshot request rate limit 초과 (세션 {})", context.session().getId());
            return;
        }
        presenceNotifier.sendPresenceSnapshotToSession(context.session(), context.diagramId(), null);
    }
}
