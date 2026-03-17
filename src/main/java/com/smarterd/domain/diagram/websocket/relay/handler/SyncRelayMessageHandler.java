package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Yjs sync step 메시지를 같은 room에 relay한다.
 */
@Component
@RequiredArgsConstructor
public class SyncRelayMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(
        DiagramMessageTypes.MSG_SYNC_STEP1,
        DiagramMessageTypes.MSG_SYNC_STEP2
    );

    private final DiagramMessageSender messageSender;

    /**
     * {@inheritDoc}
     */
    @Override
    public Set<Byte> supportedTypes() {
        return SUPPORTED_TYPES;
    }

    /**
     * Yjs sync step 요청/응답을 같은 room의 다른 세션으로 그대로 전달한다.
     *
     * @param context 메시지 컨텍스트
     */
    @Override
    public void handle(DiagramMessageContext context) {
        messageSender.broadcastToRoom(context.diagramId(), context.session(), context.message());
    }
}
