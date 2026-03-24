package com.smarterd.domain.diagram.websocket.relay;

import com.smarterd.application.collaboration.query.LoadCollaborationHandoffUseCase;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * handoff snapshot 로드, 포맷 분기, 세션 전송, 관측 로그를 한곳에서 처리한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiagramHandoffSnapshotResponder {

    private final LoadCollaborationHandoffUseCase loadCollaborationHandoffUseCase;
    private final DiagramMessageSender messageSender;

    /**
     * handoff snapshot을 로드해 요청 세션으로 응답 메시지를 전송한다.
     *
     * @param context 메시지 컨텍스트
     */
    public void respond(DiagramMessageContext context) {
        final var startedAt = System.nanoTime();
        try {
            final var loadStartedAt = System.nanoTime();
            final var handoff = loadCollaborationHandoffUseCase.loadHandoffSnapshot(context.resourceKey());
            final var loadEndedAt = System.nanoTime();
            final var messageType = context.messageType();
            final var snapshot = handoff.snapshot();
            final var snapshotSource = handoff.source();
            if (snapshot.length == 0) {
                log.info(
                    "snapshot-handoff diagramId={} session={} mode={} source={} snapshotBytes=0 loadMs={} decodeMs=0 sendMs=0 totalMs={}",
                    context.diagramId(),
                    context.sessionId(),
                    messageType == DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2 ? "v2" : "v1",
                    snapshotSource,
                    nanosToMillis(loadEndedAt - loadStartedAt),
                    nanosToMillis(System.nanoTime() - startedAt)
                );
                return;
            }

            if (messageType == DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2) {
                sendV2(context, snapshot, snapshotSource, loadStartedAt, loadEndedAt, startedAt);
                return;
            }

            sendV1(context, snapshot, snapshotSource, loadStartedAt, loadEndedAt, startedAt);
        } catch (Exception e) {
            log.error("스냅샷 전송 실패 (다이어그램 {})", context.diagramId(), e);
        }
    }

    private void sendV2(
        DiagramMessageContext context,
        byte[] snapshot,
        String snapshotSource,
        long loadStartedAt,
        long loadEndedAt,
        long startedAt
    ) throws Exception {
        final var sendStartedAt = System.nanoTime();
        messageSender.sendBinaryToSession(
            context.session(),
            messageSender.wrapMessage(DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE_V2, snapshot)
        );
        final var sendEndedAt = System.nanoTime();
        log.info(
            "snapshot-handoff diagramId={} session={} mode=v2 source={} snapshotBytes={} updateCount=-1 sentUpdateBytes={} loadMs={} decodeMs=0 sendMs={} totalMs={}",
            context.diagramId(),
            context.sessionId(),
            snapshotSource,
            snapshot.length,
            snapshot.length,
            nanosToMillis(loadEndedAt - loadStartedAt),
            nanosToMillis(sendEndedAt - sendStartedAt),
            nanosToMillis(sendEndedAt - startedAt)
        );
    }

    private void sendV1(
        DiagramMessageContext context,
        byte[] snapshot,
        String snapshotSource,
        long loadStartedAt,
        long loadEndedAt,
        long startedAt
    ) throws Exception {
        final var decodeStartedAt = System.nanoTime();
        final List<byte[]> updates = YjsUpdateFormat.decode(snapshot);
        final var decodeEndedAt = System.nanoTime();
        final var sendStartedAt = System.nanoTime();
        final var sentBytes = messageSender.sendWrappedMessagesToSession(
            context.session(),
            DiagramMessageTypes.MSG_SNAPSHOT_RESPONSE,
            updates
        );
        final var sendEndedAt = System.nanoTime();
        log.info(
            "snapshot-handoff diagramId={} session={} mode=v1 source={} snapshotBytes={} updateCount={} sentUpdateBytes={} loadMs={} decodeMs={} sendMs={} totalMs={}",
            context.diagramId(),
            context.sessionId(),
            snapshotSource,
            snapshot.length,
            updates.size(),
            sentBytes,
            nanosToMillis(loadEndedAt - loadStartedAt),
            nanosToMillis(decodeEndedAt - decodeStartedAt),
            nanosToMillis(sendEndedAt - sendStartedAt),
            nanosToMillis(sendEndedAt - startedAt)
        );
    }

    private static long nanosToMillis(long nanos) {
        return nanos / 1_000_000L;
    }
}
