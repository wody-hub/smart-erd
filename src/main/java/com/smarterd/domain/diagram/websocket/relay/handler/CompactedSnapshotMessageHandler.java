package com.smarterd.domain.diagram.websocket.relay.handler;

import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.Arrays;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 클라이언트 컴팩션 스냅샷 교체 요청 처리기.
 *
 * <p>단독 접속 여부를 검증한 뒤 기존 누적 update를 drain하고, 스냅샷 교체 실패 시 drain 데이터를 복원한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CompactedSnapshotMessageHandler implements DiagramMessageHandler {

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
            // 락 획득 후 다시 체크하여 TOCTOU 레이스를 차단한다.
            if (snapshotService.isCompactionInCoolDown(context.diagramId())) {
                return;
            }

            // 원자적으로 단독 접속 확인 + 누적 update drain (sessions 락 내부에서 수행)
            final var mergedUpdates = roomManager.drainIfAlone(context.diagramId());
            if (mergedUpdates == null) {
                // 동일 사용자 멀티 탭 상황에서 반복 요청 방지를 위해 거부 쿨다운 설정
                snapshotService.setCompactionRejectCoolDown(context.diagramId());

                // 동일 사용자 멀티 탭 상황에서 빈번히 발생할 수 있으므로 debug 로깅
                if (log.isDebugEnabled()) {
                    log.debug("컴팩션 스킵: 단독 접속 아님 (diagramId={})", context.diagramId());
                }
                return;
            }

            try {
                final var success = snapshotService.replaceSnapshot(context.diagramId(), compactedUpdate);
                if (!success) {
                    // 크기 검증 실패 또는 다이어그램 미존재: drain된 update 복원
                    final var restored = roomManager.restoreUpdates(context.diagramId(), mergedUpdates);
                    if (!restored) {
                        log.error("컴팩션 실패 후 update 복원 실패 (diagramId={})", context.diagramId());
                    }
                }
            } catch (Exception e) {
                final var restored = roomManager.restoreUpdates(context.diagramId(), mergedUpdates);
                if (!restored) {
                    log.error("컴팩션 예외 후 update 복원 실패 (diagramId={})", context.diagramId());
                }
                log.error("컴팩션 실패, drain된 update 복원 (diagramId={})", context.diagramId(), e);
            }
        }
    }
}
