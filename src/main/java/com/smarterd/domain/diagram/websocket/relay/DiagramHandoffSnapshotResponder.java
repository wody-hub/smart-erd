package com.smarterd.domain.diagram.websocket.relay;

import com.smarterd.application.collaboration.query.LoadCollaborationHandoffUseCase;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
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
    /** peer 및 미반영 update 확인용 room 관리자 */
    private final DiagramRoomManager roomManager;

    /**
     * handoff snapshot을 로드해 요청 세션으로 응답 메시지를 전송한다.
     *
     * @param context 메시지 컨텍스트
     */
    public void respond(DiagramMessageContext context) {
        synchronized (roomManager.getFlushLock(context.diagramId())) {
            respondUnderLock(context);
        }
    }

    /**
     * flush/leave와 같은 경계에서 snapshot 조회 및 빈 문서 판정을 수행한다.
     *
     * @param context 요청 컨텍스트
     */
    private void respondUnderLock(DiagramMessageContext context) {
        final var startedAt = System.nanoTime();
        try {
            final var loadStartedAt = System.nanoTime();
            final var handoff = loadCollaborationHandoffUseCase.loadHandoffSnapshot(context.resourceKey());
            final var loadEndedAt = System.nanoTime();
            final var messageType = context.messageType();
            final var snapshot = handoff.snapshot();
            final var snapshotSource = handoff.source();
            if (snapshot.length == 0) {
                confirmEmptyDocument(context);
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

    /**
     * 빈 snapshot이며 미반영 update가 없을 때 v3 세션에만 확인을 보낸다.
     *
     * @param context 요청 세션 컨텍스트
     * @throws Exception 메시지 전송 실패 시
     */
    private void confirmEmptyDocument(DiagramMessageContext context) throws Exception {
        final var metadata = context.session().getAttributes().get(CollaborationAuthenticatedSession.SESSION_ATTR_KEY);
        if (!(metadata instanceof CollaborationAuthenticatedSession sessionInfo) || sessionInfo.protocolVersion() < 3) {
            return;
        }
        // 빈 판정은 DB snapshot과 room 버퍼(미반영 update 포함)를 같은 flush 경계에서 확인한 결과다.
        // 다른 peer가 있어도 서버 기준으로 비어 있으면 확인을 보낸다. v3 클라이언트는 peer의 빈
        // SYNC_STEP2가 아니라 서버 handoff만 초기화 근거로 쓰므로, peer 유무로 생략하면 영구 대기한다.
        if (roomManager.hasUpdates(context.diagramId())) {
            return;
        }
        messageSender.sendBinaryToSession(
            context.session(),
            messageSender.wrapMessage(DiagramMessageTypes.MSG_EMPTY_DOCUMENT_INITIALIZED, new byte[0])
        );
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
