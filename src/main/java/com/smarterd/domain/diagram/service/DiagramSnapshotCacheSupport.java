package com.smarterd.domain.diagram.service;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.repository.SnapshotWithRevision;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 최근 persisted Y.Doc snapshot 캐시를 관리한다.
 */
final class DiagramSnapshotCacheSupport {

    private final DiagramRepository diagramRepository;
    private final DiagramSnapshotEncodingSupport encodingSupport;
    private final Map<Long, byte[]> snapshotCache = new ConcurrentHashMap<>();

    /**
     * @param diagramRepository 다이어그램 레포지토리
     * @param encodingSupport snapshot 인코딩 지원 객체
     */
    DiagramSnapshotCacheSupport(DiagramRepository diagramRepository, DiagramSnapshotEncodingSupport encodingSupport) {
        this.diagramRepository = diagramRepository;
        this.encodingSupport = encodingSupport;
    }

    /**
     * DB 또는 캐시에서 Y.Doc snapshot을 로드한다.
     *
     * @param diagramId 다이어그램 ID
     * @return Y.Doc snapshot 바이트
     */
    byte[] loadSnapshot(Long diagramId) {
        return snapshotCache.computeIfAbsent(diagramId, (id) ->
            diagramRepository.findYdocSnapshotById(id).orElse(new byte[0])
        );
    }

    /**
     * 캐시된 snapshot을 조회한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 캐시된 snapshot Optional
     */
    Optional<byte[]> getCachedSnapshot(Long diagramId) {
        return Optional.ofNullable(snapshotCache.get(diagramId));
    }

    /**
     * Y.Doc snapshot과 revision을 DB에서 조회한다.
     *
     * @param diagramId 다이어그램 ID
     * @return snapshot/revision Optional
     */
    Optional<SnapshotWithRevision> loadSnapshotWithRevision(Long diagramId) {
        return diagramRepository.findYdocSnapshotWithRevisionById(diagramId);
    }

    /**
     * 캐시된 snapshot을 제거한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void evictCachedSnapshot(Long diagramId) {
        snapshotCache.remove(diagramId);
    }

    /**
     * 캐시에 snapshot을 저장한다.
     *
     * @param diagramId 다이어그램 ID
     * @param snapshot snapshot 바이트
     */
    void cacheSnapshot(Long diagramId, byte[] snapshot) {
        snapshotCache.put(diagramId, snapshot);
    }

    /**
     * 캐시에서 snapshot을 제거한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void removeSnapshot(Long diagramId) {
        snapshotCache.remove(diagramId);
    }

    /**
     * 전체 상태 update를 snapshot 포맷으로 인코딩해 캐시에 저장한다.
     *
     * @param diagramId 다이어그램 ID
     * @param fullStateUpdate 전체 Y.Doc 상태 update
     */
    void cacheFullStateUpdate(Long diagramId, byte[] fullStateUpdate) {
        snapshotCache.put(diagramId, encodingSupport.encodeSingleUpdate(fullStateUpdate));
    }

    /**
     * 기존 snapshot과 update를 연결한다.
     *
     * @param diagramId 다이어그램 ID
     * @param existingSnapshot 기존 snapshot
     * @param mergedUpdates 병합 update
     * @return 연결된 snapshot
     */
    byte[] combineSnapshotAndUpdates(Long diagramId, byte[] existingSnapshot, byte[] mergedUpdates) {
        return encodingSupport.combineSnapshotAndUpdates(diagramId, existingSnapshot, mergedUpdates);
    }
}
