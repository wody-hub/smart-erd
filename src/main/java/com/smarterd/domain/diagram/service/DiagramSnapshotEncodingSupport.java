package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/**
 * Y.Doc snapshot/update 인코딩과 연결을 담당한다.
 */
@Slf4j
final class DiagramSnapshotEncodingSupport {

    private static final int COMPACTION_WARN_THRESHOLD = 500;

    /**
     * 단일 Yjs update를 persisted snapshot 포맷으로 감싼다.
     *
     * @param update 단일 Yjs update
     * @return persisted snapshot 포맷 바이트
     */
    byte[] encodeSingleUpdate(byte[] update) {
        return YjsUpdateFormat.encode(List.of(update));
    }

    /**
     * 기존 DB 스냅샷과 누적 update를 연결한다.
     *
     * @param diagramId        다이어그램 ID
     * @param existingSnapshot 기존 DB 스냅샷
     * @param mergedUpdates    병합된 Yjs update
     * @return 연결된 snapshot 바이트
     */
    byte[] combineSnapshotAndUpdates(Long diagramId, byte[] existingSnapshot, byte[] mergedUpdates) {
        if (existingSnapshot.length == 0) {
            logSnapshotShape(diagramId, YjsUpdateFormat.decode(mergedUpdates).size(), mergedUpdates, mergedUpdates);
            return mergedUpdates;
        }

        if (mergedUpdates.length == 0) {
            return existingSnapshot;
        }

        final var existingUpdates = YjsUpdateFormat.decode(existingSnapshot);
        final var newUpdates = YjsUpdateFormat.decode(mergedUpdates);

        final var combined = new ArrayList<byte[]>(existingUpdates.size() + newUpdates.size());
        combined.addAll(existingUpdates);
        combined.addAll(newUpdates);

        if (combined.size() > COMPACTION_WARN_THRESHOLD) {
            log.warn(
                "Y.Doc 스냅샷 컴팩션 필요: diagramId={}, 누적 update {}개 (임계치: {}), existingBytes={}, mergedBytes={}",
                diagramId,
                combined.size(),
                COMPACTION_WARN_THRESHOLD,
                existingSnapshot.length,
                mergedUpdates.length
            );
        }

        final var encoded = YjsUpdateFormat.encode(combined);
        logSnapshotShape(diagramId, combined.size(), mergedUpdates, encoded);
        return encoded;
    }

    /**
     * 스냅샷 저장 시점의 형태를 메트릭 로그로 남긴다.
     *
     * @param diagramId 다이어그램 ID
     * @param updateCount snapshot 내부 update 개수
     * @param mergedUpdates 이번 flush에서 병합된 update blob
     * @param encoded 최종 저장 snapshot
     */
    private void logSnapshotShape(Long diagramId, int updateCount, byte[] mergedUpdates, byte[] encoded) {
        log.info(
            "snapshot-shape diagramId={} updateCount={} mergedBytes={} encodedBytes={}",
            diagramId,
            updateCount,
            mergedUpdates.length,
            encoded.length
        );
    }
}
