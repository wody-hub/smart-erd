package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.Arrays;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Yjs update 메시지 relay + 누적 저장 처리기.
 *
 * <p>메시지는 우선 room에 relay하고, 타입 바이트를 제외한 순수 update를 서버 누적 버퍼에 저장한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class YjsUpdateMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_YJS_UPDATE);

    private final DiagramRoomManager roomManager;
    private final DiagramMessageSender messageSender;

    /**
     * {@inheritDoc}
     */
    @Override
    public Set<Byte> supportedTypes() {
        return SUPPORTED_TYPES;
    }

    /**
     * update relay 및 누적 버퍼 저장을 수행한다.
     *
     * @param context 메시지 컨텍스트
     */
    @Override
    public void handle(DiagramMessageContext context) {
        messageSender.broadcastToRoom(context.diagramId(), context.session(), context.message());

        // 타입 바이트(0x03) 제외한 순수 Yjs update만 누적
        final var payload = context.payload();
        final var accepted = roomManager.appendUpdate(
            context.diagramId(),
            Arrays.copyOfRange(payload, 1, payload.length)
        );
        if (!accepted) {
            log.warn(
                "누적 update 크기 초과로 저장 거부 (diagramId={}, 세션 {})",
                context.diagramId(),
                context.session().getId()
            );
        }
    }
}
