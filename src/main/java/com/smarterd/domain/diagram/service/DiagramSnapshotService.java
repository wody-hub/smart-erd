package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.DiagramRoomManager;
import com.smarterd.domain.diagram.websocket.YjsUpdateFormat;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Y.Doc 스냅샷 저장/로드 전담 서비스.
 *
 * <p>WebSocket 연결 종료 시 또는 주기적으로 인메모리 누적 Yjs update를
 * 기존 DB 스냅샷과 연결하여 저장하고, 새 클라이언트 연결 시 스냅샷을 로드한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class DiagramSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(DiagramSnapshotService.class);

    /** 누적 update 수 경고 임계치 (초과 시 컴팩션 필요 경고) */
    private static final int COMPACTION_WARN_THRESHOLD = 500;

    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;

    /** 방 관리자 (dirty ID 조회 + 누적 update 병합용) */
    private final DiagramRoomManager roomManager;

    /** 다이어그램별 개별 트랜잭션 실행용 (flush 락 안에서 커밋 보장) */
    private final TransactionTemplate transactionTemplate;

    /**
     * 누적된 Yjs update를 기존 DB 스냅샷에 연결하여 저장한다.
     * 마지막 사용자 퇴장 시 호출된다.
     *
     * @param diagramId      다이어그램 ID
     * @param mergedUpdates  병합된 Yjs update 바이트 배열
     */
    @Transactional
    public void saveSnapshotWithUpdates(Long diagramId, byte[] mergedUpdates) {
        final var existingSnapshot = diagramRepository.findYdocSnapshotById(diagramId).orElse(null);
        final var combined = combineSnapshotAndUpdates(diagramId, existingSnapshot, mergedUpdates);
        final var updated = diagramRepository.updateYdocSnapshotById(diagramId, combined);
        if (updated == 0) {
            log.warn("스냅샷 저장 실패: 다이어그램 미존재 (id={})", diagramId);
            return;
        }
        log.info("Y.Doc 스냅샷 저장 완료: diagramId={}, size={}bytes", diagramId, combined.length);
    }

    /**
     * DB에서 Y.Doc 스냅샷을 로드한다.
     * 프로젝션 쿼리로 ydocSnapshot만 조회하여 불필요한 content TEXT 로딩을 방지한다.
     *
     * @param diagramId 다이어그램 ID
     * @return Y.Doc 스냅샷 바이트 배열, 없으면 빈 배열
     */
    public byte[] loadSnapshot(Long diagramId) {
        return diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]);
    }

    /**
     * 변경된 인메모리 누적 update를 주기적으로 DB에 저장한다.
     *
     * <p>{@code smart-erd.websocket.snapshot-flush-interval} 주기로 실행되며,
     * dirty 플래그가 설정된 다이어그램만 처리한다.
     * 개별 다이어그램 저장 실패 시 해당 ID를 다시 dirty로 표시하여 다음 주기에 재시도한다.</p>
     */
    @Scheduled(fixedDelayString = "${smart-erd.websocket.snapshot-flush-interval:30000}")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void flushDirtySnapshots() {
        final var dirtyIds = roomManager.getDirtyIdsAndClear();
        if (dirtyIds.isEmpty()) {
            return;
        }

        try {
            var savedCount = 0;
            for (final var id : dirtyIds) {
                if (flushSingleDiagram(id)) {
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                log.info("주기적 Y.Doc 스냅샷 저장 완료: {}개 다이어그램", savedCount);
            }
        } catch (Exception e) {
            // 최상위 예외 발생 시 dirty ID 전체를 복구하여 다음 주기에 재시도
            log.error("주기적 스냅샷 저장 중 예외 발생, dirty ID 복구: {}개", dirtyIds.size(), e);
            for (final var id : dirtyIds) {
                roomManager.reDirty(id);
            }
        }
    }

    /**
     * 단일 다이어그램의 누적 update를 DB에 저장한다.
     * flush 락 안에서 트랜잭션 커밋까지 완료하여 락 해제 전에 DB 영속화를 보장한다.
     *
     * @param id 다이어그램 ID
     * @return 저장 성공 여부
     */
    private boolean flushSingleDiagram(Long id) {
        // @Scheduled flush와 연결 종료 flush 간 레이스 방지를 위해 다이어그램별 flush 락 사용
        // TransactionTemplate으로 flush 락 안에서 커밋까지 완료
        synchronized (roomManager.getFlushLock(id)) {
            byte[] mergedUpdates = null;
            try {
                // drain: 원자적으로 누적 update를 추출 + 비움
                mergedUpdates = roomManager.drainAndMergeUpdates(id);
                if (mergedUpdates.length == 0) {
                    return false;
                }

                final var updates = mergedUpdates;
                final var result = transactionTemplate.execute((status) -> {
                    final var existingSnapshot =
                        diagramRepository.findYdocSnapshotById(id).orElse(null);
                    final var combined = combineSnapshotAndUpdates(id, existingSnapshot, updates);
                    final var updated = diagramRepository.updateYdocSnapshotById(id, combined);
                    if (updated == 0) {
                        log.warn("주기적 스냅샷 저장 실패: 다이어그램 미존재 (id={})", id);
                        return false;
                    }
                    log.debug("주기적 Y.Doc 스냅샷 저장: diagramId={}, size={}bytes", id, combined.length);
                    return true;
                });
                return Boolean.TRUE.equals(result);
            } catch (Exception e) {
                log.error("주기적 스냅샷 저장 실패 (diagramId={})", id, e);
                // drain 후 DB 저장 실패: drain된 데이터를 개별 update로 디코딩 후 재삽입
                if (mergedUpdates != null && mergedUpdates.length > 0) {
                    final var updates = YjsUpdateFormat.decode(mergedUpdates);
                    for (final var update : updates) {
                        roomManager.appendUpdate(id, update);
                    }
                    log.info("drain된 update {}개 복원 완료 (diagramId={})", updates.size(), id);
                }
                return false;
            }
        }
    }

    /**
     * 기존 DB 스냅샷과 누적 update를 연결한다.
     *
     * @param diagramId        다이어그램 ID (로그용)
     * @param existingSnapshot 기존 DB 스냅샷 (null이면 없음)
     * @param mergedUpdates    병합된 Yjs update 바이트
     * @return 기존 스냅샷 + 누적 update를 연결한 바이트 배열
     */
    private byte[] combineSnapshotAndUpdates(Long diagramId, byte[] existingSnapshot, byte[] mergedUpdates) {
        if (existingSnapshot == null || existingSnapshot.length == 0) {
            return mergedUpdates;
        }

        if (mergedUpdates.length == 0) {
            return existingSnapshot;
        }

        // 기존 스냅샷(레거시 또는 YLPF)과 새 업데이트를 개별 리스트로 디코딩 후 재인코딩
        final var existingUpdates = YjsUpdateFormat.decode(existingSnapshot);
        final var newUpdates = YjsUpdateFormat.decode(mergedUpdates);

        final var combined = new ArrayList<byte[]>(existingUpdates.size() + newUpdates.size());
        combined.addAll(existingUpdates);
        combined.addAll(newUpdates);

        if (combined.size() > COMPACTION_WARN_THRESHOLD) {
            log.warn(
                "Y.Doc 스냅샷 컴팩션 필요: diagramId={}, 누적 update {}개 (임계치: {})",
                diagramId,
                combined.size(),
                COMPACTION_WARN_THRESHOLD
            );
        }

        return YjsUpdateFormat.encode(combined);
    }
}
