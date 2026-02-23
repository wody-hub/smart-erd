package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;

/**
 * 스냅샷 재전송 요청 처리기.
 *
 * <p>DB에 저장된 length-prefixed snapshot을 디코딩해 개별 update 단위로 클라이언트에 전송한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SnapshotRequestMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_SNAPSHOT_REQUEST);

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotService snapshotService;
    private final DiagramMessageSender messageSender;

    /**
     * {@inheritDoc}
     */
    @Override
    public Set<Byte> supportedTypes() {
        return SUPPORTED_TYPES;
    }

    /**
     * 스냅샷 요청을 처리해 요청 세션으로 snapshot 응답 메시지들을 전송한다.
     *
     * @param context 메시지 컨텍스트
     */
    @Override
    public void handle(DiagramMessageContext context) {
        try {
            final var snapshot = snapshotService.loadSnapshot(context.diagramId());
            if (snapshot.length == 0) {
                return;
            }

            // length-prefixed 포맷을 디코딩하여 개별 Yjs update를 각각 전송
            final var updates = YjsUpdateFormat.decode(snapshot);
            final var lock = roomManager.getSessionLock(context.session());
            synchronized (lock) {
                for (final var update : updates) {
                    context
                        .session()
                        .sendMessage(
                            new BinaryMessage(
                                Objects.requireNonNull(
                                    messageSender.wrapMessage(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE, update)
                                )
                            )
                        );
                }
            }
        } catch (Exception e) {
            log.error("스냅샷 전송 실패 (다이어그램 {})", context.diagramId(), e);
        }
    }
}
