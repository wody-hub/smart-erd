package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.application.diagram.command.ApplyDiagramCompactedSnapshotUseCase;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import java.util.Arrays;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 클라이언트 컴팩션 스냅샷 교체 요청 처리기.
 *
 * <p>단독 접속 여부를 검증한 뒤 기존 누적 update를 drain하고, 스냅샷 교체 실패 시 drain 데이터를 복원한다.</p>
 */
@Component
@RequiredArgsConstructor
public class CompactedSnapshotMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_COMPACTED_SNAPSHOT);

    private final ApplyDiagramCompactedSnapshotUseCase applyDiagramCompactedSnapshotUseCase;

    /**
     * {@inheritDoc}
     */
    @Override
    public Set<Byte> supportedTypes() {
        return SUPPORTED_TYPES;
    }

    /**
     * 컴팩션 요청 payload를 파싱하고 snapshot 교체를 수행한다.
     *
     * @param context 메시지 컨텍스트
     */
    @Override
    public void handle(DiagramMessageContext context) {
        final var payload = context.payload();
        final var compactedUpdate = Arrays.copyOfRange(payload, 1, payload.length);
        applyDiagramCompactedSnapshotUseCase.apply(context.diagramId(), compactedUpdate);
    }
}
