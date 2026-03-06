package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;

/**
 * 스냅샷 재전송 요청 처리기.
 *
 * <p>DB에 저장된 length-prefixed snapshot을 디코딩해 개별 update 단위로 클라이언트에 전송한다.
 * protocolVersion >= 2인 클라이언트에는 각 프레임에 snapshotRevision을 포함하는 v2 바이너리 포맷을 사용한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SnapshotRequestMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_SNAPSHOT_REQUEST);

    /** v2 프레임 헤더 크기: type(1byte) + revision(8byte) */
    private static final int V2_HEADER_SIZE = 1 + Long.BYTES;

    /** snapshotRevision이 null(레거시)일 때 v2 프레임에 담는 마커값. 클라이언트는 음수 revision을 null로 처리한다. */
    private static final long REVISION_NULL_MARKER = -1L;

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
        if (context.sessionInfo().protocolVersion() >= 2) {
            handleV2(context);
        } else {
            handleV1(context);
        }
    }

    /**
     * v1 프로토콜: 기존 포맷 (타입 + Yjs update 바이너리).
     *
     * @param context 메시지 컨텍스트
     */
    private void handleV1(DiagramMessageContext context) {
        try {
            final var snapshot = snapshotService.loadSnapshot(context.diagramId());
            if (snapshot.length == 0) {
                return;
            }

            final var updates = YjsUpdateFormat.decode(snapshot);
            sendUpdates(context, updates, (update) ->
                Objects.requireNonNull(messageSender.wrapMessage(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE, update))
            );
        } catch (Exception e) {
            log.error("스냅샷 전송 실패 (다이어그램 {})", context.diagramId(), e);
        }
    }

    /**
     * v2 프로토콜: 각 프레임에 [1byte type][8byte revision big-endian][Yjs binary] 포맷.
     *
     * @param context 메시지 컨텍스트
     */
    private void handleV2(DiagramMessageContext context) {
        try {
            final var result = snapshotService.loadSnapshotWithRevision(context.diagramId());
            if (result.isEmpty()) {
                return;
            }

            final var snapshotWithRevision = result.get();
            final var snapshotBytes = snapshotWithRevision.ydocSnapshot();
            if (snapshotBytes == null || snapshotBytes.length == 0) {
                return;
            }

            // snapshotRevision이 null이면(마이그레이션 이전 레거시 데이터) -1 마커를 사용.
            // 클라이언트는 음수 revision을 null로 변환하여 리비전 검증을 스킵한다.
            final var revision = snapshotWithRevision.snapshotRevision() != null
                ? snapshotWithRevision.snapshotRevision()
                : REVISION_NULL_MARKER;
            final var updates = YjsUpdateFormat.decode(snapshotBytes);
            sendUpdates(context, updates, (update) -> {
                final var frame = ByteBuffer.allocate(V2_HEADER_SIZE + update.length);
                frame.put(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE);
                frame.putLong(revision);
                frame.put(update);
                return frame.array();
            });
        } catch (Exception e) {
            log.error("v2 스냅샷 전송 실패 (다이어그램 {})", context.diagramId(), e);
        }
    }

    /**
     * 디코딩된 update 목록을 세션 락 보호 하에 순차 전송한다.
     *
     * @param context      메시지 컨텍스트
     * @param updates      전송할 update 목록
     * @param frameBuilder update를 전송 프레임 바이트로 변환하는 함수
     * @throws IOException 메시지 전송 실패 시
     */
    private void sendUpdates(DiagramMessageContext context, List<byte[]> updates, Function<byte[], byte[]> frameBuilder)
        throws IOException {
        final var lock = roomManager.getSessionLock(context.session());
        synchronized (lock) {
            for (final var update : updates) {
                context.session().sendMessage(new BinaryMessage(frameBuilder.apply(update)));
            }
        }
    }
}
