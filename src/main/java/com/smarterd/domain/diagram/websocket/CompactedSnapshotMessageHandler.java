package com.smarterd.domain.diagram.websocket;

import java.util.Arrays;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;

import lombok.RequiredArgsConstructor;

/**
 * 클라이언트 컴팩션 스냅샷 교체 요청 처리기.
 *
 * <p>단독 접속 여부를 검증한 뒤 기존 누적 update를 drain하고, 스냅샷 교체 실패 시 drain 데이터를 복원한다.</p>
 */
@Component
@RequiredArgsConstructor
public class CompactedSnapshotMessageHandler implements DiagramMessageHandler {

    private static final Logger log = LoggerFactory.getLogger(CompactedSnapshotMessageHandler.class);

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_COMPACTED_SNAPSHOT);

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotService snapshotService;

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
        if (compactedUpdate.length == 0) {
            return;
        }

        // flushLock: @Scheduled flush의 drainAndMergeUpdates()와 동시 drain 방지
        synchronized (roomManager.getFlushLock(context.diagramId())) {
            // 원자적으로 단독 접속 확인 + 누적 update drain (sessions 락 내부에서 수행)
            final var mergedUpdates = roomManager.drainIfAlone(context.diagramId());
            if (mergedUpdates == null) {
                log.warn("컴팩션 거부: 단독 접속 아님 (diagramId={})", context.diagramId());
                return;
            }

            try {
                final var success = snapshotService.replaceSnapshot(context.diagramId(), compactedUpdate);
                if (!success) {
                    // 크기 검증 실패 또는 다이어그램 미존재: drain된 update 복원
                    roomManager.restoreUpdates(context.diagramId(), mergedUpdates);
                }
            } catch (Exception e) {
                roomManager.restoreUpdates(context.diagramId(), mergedUpdates);
                log.error("컴팩션 실패, drain된 update 복원 (diagramId={})", context.diagramId(), e);
            }
        }
    }
}


