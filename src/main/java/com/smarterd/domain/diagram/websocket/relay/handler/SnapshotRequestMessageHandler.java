package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.domain.diagram.websocket.relay.DiagramHandoffSnapshotResponder;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 스냅샷 재전송 요청 처리기.
 *
 * <p>v1은 DB에 저장된 length-prefixed snapshot을 디코딩해 개별 update 단위로 전송하고,
 * v2는 raw snapshot blob을 단건 handoff payload로 전송한다.</p>
 */
@Component
@RequiredArgsConstructor
public class SnapshotRequestMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST,
        DiagramMessageTypes.MSG_SNAPSHOT_REQUEST_V2
    );

    private final DiagramHandoffSnapshotResponder handoffSnapshotResponder;

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
        handoffSnapshotResponder.respond(context);
    }
}
