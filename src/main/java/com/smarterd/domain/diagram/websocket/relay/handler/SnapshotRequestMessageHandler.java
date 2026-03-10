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
 * <p>v1은 DB에 저장된 length-prefixed snapshot을 디코딩해 개별 update 단위로 전송하고,
 * v2는 raw snapshot blob을 단건 handoff payload로 전송한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SnapshotRequestMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST,
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2
    );

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
        final var startedAt = System.nanoTime();
        try {
            final var loadStartedAt = System.nanoTime();
            final var roomSessionCount = roomManager.getSessionCount(context.diagramId());
            final var pendingUpdates = roomSessionCount > 1 ? roomManager.peekMergedUpdates(context.diagramId()) : new byte[0];
            final var cachedSnapshot = roomSessionCount > 1
                ? snapshotService.getCachedSnapshot(context.diagramId()).orElse(null)
                : null;
            final var hasWarmBase = cachedSnapshot != null;
            final byte[] snapshot;
            if (pendingUpdates.length > 0) {
                snapshot = snapshotService.buildWarmHandoffSnapshot(context.diagramId(), pendingUpdates);
            } else if (hasWarmBase) {
                snapshot = cachedSnapshot;
            } else {
                snapshot = snapshotService.loadSnapshot(context.diagramId());
            }
            final var loadEndedAt = System.nanoTime();
            final var messageType = context.messageType();
            final var snapshotSource = pendingUpdates.length > 0 || hasWarmBase ? "warm" : "db";
            if (snapshot.length == 0) {
                log.info(
                    "snapshot-handoff diagramId={} session={} mode={} source={} snapshotBytes=0 loadMs={} decodeMs=0 sendMs=0 totalMs={}",
                    context.diagramId(),
                    context.session().getId(),
                    messageType == DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2 ? "v2" : "v1",
                    snapshotSource,
                    nanosToMillis(loadEndedAt - loadStartedAt),
                    nanosToMillis(System.nanoTime() - startedAt)
                );
                return;
            }

            if (messageType == DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2) {
                final var sendStartedAt = System.nanoTime();
                messageSender.sendBinaryToSession(
                    context.session(),
                    messageSender.wrapMessage(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2, snapshot)
                );
                final var sendEndedAt = System.nanoTime();
                log.info(
                    "snapshot-handoff diagramId={} session={} mode=v2 source={} snapshotBytes={} updateCount=-1 sentUpdateBytes={} loadMs={} decodeMs=0 sendMs={} totalMs={}",
                    context.diagramId(),
                    context.session().getId(),
                    snapshotSource,
                    snapshot.length,
                    snapshot.length,
                    nanosToMillis(loadEndedAt - loadStartedAt),
                    nanosToMillis(sendEndedAt - sendStartedAt),
                    nanosToMillis(sendEndedAt - startedAt)
                );
                return;
            }

            // length-prefixed 포맷을 디코딩하여 개별 Yjs update를 각각 전송
            final var decodeStartedAt = System.nanoTime();
            final var updates = YjsUpdateFormat.decode(snapshot);
            final var decodeEndedAt = System.nanoTime();
            var sentBytes = 0;
            final var sendStartedAt = System.nanoTime();
            final var lock = roomManager.getSessionLock(context.session());
            synchronized (lock) {
                for (final var update : updates) {
                    sentBytes += update.length;
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
            final var sendEndedAt = System.nanoTime();
            log.info(
                "snapshot-handoff diagramId={} session={} mode=v1 source={} snapshotBytes={} updateCount={} sentUpdateBytes={} loadMs={} decodeMs={} sendMs={} totalMs={}",
                context.diagramId(),
                context.session().getId(),
                snapshotSource,
                snapshot.length,
                updates.size(),
                sentBytes,
                nanosToMillis(loadEndedAt - loadStartedAt),
                nanosToMillis(decodeEndedAt - decodeStartedAt),
                nanosToMillis(sendEndedAt - sendStartedAt),
                nanosToMillis(sendEndedAt - startedAt)
            );
        } catch (Exception e) {
            log.error("스냅샷 전송 실패 (다이어그램 {})", context.diagramId(), e);
        }
    }

    private static long nanosToMillis(long nanos) {
        return nanos / 1_000_000L;
    }
}
