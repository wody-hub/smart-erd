package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Y.Doc snapshot 컴팩션과 쿨다운 상태를 담당한다.
 */
@Slf4j
final class DiagramSnapshotCompactionSupport {

    private static final double COMPACTION_SIZE_TOLERANCE = 1.1;
    private static final Duration COMPACTION_COOL_DOWN = Duration.ofMinutes(1);
    private static final Duration COMPACTION_REJECT_COOL_DOWN = Duration.ofSeconds(30);

    private final DiagramRepository diagramRepository;
    private final DiagramSnapshotCacheSupport cacheSupport;
    private final DiagramSnapshotEncodingSupport encodingSupport;
    private final Map<Long, Instant> compactionBlockedUntil = new ConcurrentHashMap<>();

    /**
     * @param diagramRepository 다이어그램 레포지토리
     * @param cacheSupport snapshot 캐시 지원 객체
     * @param encodingSupport snapshot 인코딩 지원 객체
     */
    DiagramSnapshotCompactionSupport(
        DiagramRepository diagramRepository,
        DiagramSnapshotCacheSupport cacheSupport,
        DiagramSnapshotEncodingSupport encodingSupport
    ) {
        this.diagramRepository = diagramRepository;
        this.cacheSupport = cacheSupport;
        this.encodingSupport = encodingSupport;
    }

    /**
     * 컴팩션된 snapshot으로 기존 ydocSnapshot을 교체한다.
     *
     * @param diagramId 다이어그램 ID
     * @param compactedUpdate 클라이언트가 전송한 컴팩션 update
     * @return 교체 성공 여부
     */
    boolean replaceSnapshot(Long diagramId, byte[] compactedUpdate) {
        final var contentRevision = diagramRepository.findContentRevisionForUpdate(diagramId);
        if (contentRevision == null) {
            log.warn("컴팩션 실패: 다이어그램 미존재 (id={})", diagramId);
            return false;
        }

        final var existingSnapshot = diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]);
        final var existingSize = existingSnapshot.length;
        final var compactedSnapshot = encodingSupport.encodeSingleUpdate(compactedUpdate);

        if (existingSize > 0 && compactedSnapshot.length > existingSize * COMPACTION_SIZE_TOLERANCE) {
            log.warn(
                "컴팩션 거부: 크기 증가 (diagramId={}, existing={}B, compacted={}B)",
                diagramId,
                existingSize,
                compactedSnapshot.length
            );
            return false;
        }

        final var updated = diagramRepository.updateYdocSnapshotAndRevisionById(
            diagramId,
            compactedSnapshot,
            contentRevision
        );
        if (updated == 0) {
            log.warn("컴팩션 실패: 다이어그램 미존재 (id={})", diagramId);
            return false;
        }

        cacheSupport.cacheSnapshot(diagramId, compactedSnapshot);
        logCompactionSuccess(diagramId, existingSize, compactedSnapshot.length, contentRevision);
        compactionBlockedUntil.put(diagramId, Instant.now().plus(COMPACTION_COOL_DOWN));
        return true;
    }

    /**
     * 컴팩션 쿨다운 여부를 조회한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 쿨다운 중이면 true
     */
    boolean isCompactionInCoolDown(Long diagramId) {
        final var blockedUntil = compactionBlockedUntil.get(diagramId);
        if (blockedUntil == null) {
            return false;
        }

        final var now = Instant.now();
        if (now.isBefore(blockedUntil)) {
            return true;
        }

        compactionBlockedUntil.remove(diagramId, blockedUntil);
        return false;
    }

    /**
     * 특정 다이어그램의 컴팩션 쿨다운을 제거한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void clearCompactionCoolDown(Long diagramId) {
        compactionBlockedUntil.remove(diagramId);
    }

    /**
     * 모든 컴팩션 쿨다운을 제거한다.
     */
    void clearAllCoolDowns() {
        compactionBlockedUntil.clear();
    }

    /**
     * warm handoff용 persisted snapshot과 누적 update를 연결한다.
     *
     * @param diagramId 다이어그램 ID
     * @param mergedUpdates 인메모리 누적 update blob
     * @return handoff용 snapshot blob
     */
    byte[] buildWarmHandoffSnapshot(Long diagramId, byte[] mergedUpdates) {
        final var persistedSnapshot = cacheSupport.loadSnapshot(diagramId);
        return cacheSupport.combineSnapshotAndUpdates(diagramId, persistedSnapshot, mergedUpdates);
    }

    /**
     * 컴팩션 거부 쿨다운을 설정한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void setCompactionRejectCoolDown(Long diagramId) {
        compactionBlockedUntil.put(diagramId, Instant.now().plus(COMPACTION_REJECT_COOL_DOWN));
    }

    /**
     * 컴팩션 성공 로그를 남긴다.
     *
     * @param diagramId 다이어그램 ID
     * @param existingSize 기존 snapshot 크기
     * @param compactedSize 컴팩션 snapshot 크기
     * @param contentRevision snapshotRevision
     */
    private void logCompactionSuccess(Long diagramId, int existingSize, int compactedSize, Long contentRevision) {
        log.info(
            "Y.Doc 스냅샷 컴팩션 완료: diagramId={}, before={}B, after={}B ({}% 감소)",
            diagramId,
            existingSize,
            compactedSize,
            existingSize > 0 ? (100 - (compactedSize * 100) / existingSize) : 0
        );
        log.debug("Y.Doc 스냅샷 컴팩션 revision: diagramId={}, snapshotRevision={}", diagramId, contentRevision);
    }
}
