package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 WebSocket inbound 메시지 타입을 핸들러로 디스패치한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiagramWebSocketMessageDispatcher {

    private final List<DiagramMessageHandler> messageHandlers;

    private Map<Byte, DiagramMessageHandler> messageHandlerMap = Map.of();

    private static final Set<Byte> REQUIRED_INBOUND_MESSAGE_TYPES = Set.of(
        DiagramMessageTypes.MSG_SYNC_STEP1,
        DiagramMessageTypes.MSG_SYNC_STEP2,
        DiagramMessageTypes.MSG_YJS_UPDATE,
        DiagramMessageTypes.MSG_AWARENESS,
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST,
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2,
        DiagramMessageTypes.MSG_COMPACTED_SNAPSHOT,
        DiagramMessageTypes.MSG_PRESENCE_SNAPSHOT_REQUEST
    );

    @PostConstruct
    void initHandlerMap() {
        final var map = new HashMap<Byte, DiagramMessageHandler>();
        for (final var handler : messageHandlers) {
            for (final var type : handler.supportedTypes()) {
                if (!REQUIRED_INBOUND_MESSAGE_TYPES.contains(type)) {
                    throw new IllegalStateException(
                        "등록 불가 메시지 타입 감지: " +
                            formatMessageTypes(Set.of(type)) +
                            ", handler=" +
                            handler.getClass().getSimpleName()
                    );
                }
                final var previous = map.putIfAbsent(type, handler);
                if (previous != null) {
                    throw new IllegalStateException(
                        "중복 메시지 핸들러 등록: type=0x" +
                            String.format("%02x", Byte.toUnsignedInt(type)) +
                            ", first=" +
                            previous.getClass().getSimpleName() +
                            ", second=" +
                            handler.getClass().getSimpleName()
                    );
                }
            }
        }

        if (!map.keySet().containsAll(REQUIRED_INBOUND_MESSAGE_TYPES)) {
            final var missingTypes = REQUIRED_INBOUND_MESSAGE_TYPES.stream()
                .filter((type) -> !map.containsKey(type))
                .collect(Collectors.toSet());
            throw new IllegalStateException("필수 메시지 핸들러 누락: " + formatMessageTypes(missingTypes));
        }

        messageHandlerMap = Map.copyOf(map);
    }

    /**
     * 컨텍스트의 메시지 타입에 맞는 핸들러로 디스패치한다.
     *
     * @param context inbound 메시지 컨텍스트
     */
    public void dispatch(DiagramMessageContext context) {
        final var messageType = context.messageType();
        final var messageHandler = messageHandlerMap.get(messageType);
        if (messageHandler == null) {
            if (log.isDebugEnabled()) {
                log.debug("알 수 없는 메시지 타입: 0x{}", String.format("%02x", Byte.toUnsignedInt(messageType)));
            }
            return;
        }

        try {
            messageHandler.handle(context);
        } catch (Exception e) {
            log.error(
                "메시지 처리 실패 (type=0x{}, diagramId={}, session={})",
                String.format("%02x", Byte.toUnsignedInt(messageType)),
                context.diagramId(),
                context.session().getId(),
                e
            );
        }
    }

    private String formatMessageTypes(Set<Byte> types) {
        return types
            .stream()
            .map((type) -> String.format("0x%02x", Byte.toUnsignedInt(type)))
            .sorted()
            .collect(Collectors.joining(", "));
    }
}
