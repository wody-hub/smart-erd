package com.smarterd.domain.diagram.service;

import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import lombok.extern.slf4j.Slf4j;

/**
 * Y.Doc snapshot의 직접 저장 경로를 담당한다.
 */
@Slf4j
final class DiagramSnapshotPersistenceSupport {

    private final DiagramRepository diagramRepository;
    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotCacheSupport cacheSupport;
    private final DiagramSnapshotEncodingSupport encodingSupport;

    /**
     * @param diagramRepository 다이어그램 레포지토리
     * @param roomManager 방 관리자
     * @param cacheSupport snapshot 캐시 지원 객체
     * @param encodingSupport snapshot 인코딩 지원 객체
     */
    DiagramSnapshotPersistenceSupport(
        DiagramRepository diagramRepository,
        DiagramRoomManager roomManager,
        DiagramSnapshotCacheSupport cacheSupport,
        DiagramSnapshotEncodingSupport encodingSupport
    ) {
        this.diagramRepository = diagramRepository;
        this.roomManager = roomManager;
        this.cacheSupport = cacheSupport;
        this.encodingSupport = encodingSupport;
    }

    /**
     * 누적 update를 기존 DB snapshot에 연결하여 저장한다.
     *
     * @param diagramId 다이어그램 ID
     * @param mergedUpdates 병합된 Yjs update
     */
    void saveSnapshotWithUpdates(Long diagramId, byte[] mergedUpdates) {
        final var contentRevision = diagramRepository.findContentRevisionForUpdate(diagramId);
        if (contentRevision == null) {
            log.warn("스냅샷 저장 실패: 다이어그램 미존재 (id={})", diagramId);
            return;
        }
        final var existingSnapshot = diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]);
        final var combined = cacheSupport.combineSnapshotAndUpdates(diagramId, existingSnapshot, mergedUpdates);
        final var updated = diagramRepository.updateYdocSnapshotAndRevisionById(diagramId, combined, contentRevision);
        if (updated == 0) {
            log.warn("스냅샷 저장 실패: 다이어그램 미존재 (id={})", diagramId);
            return;
        }
        cacheSupport.cacheSnapshot(diagramId, combined);
        log.info(
            "Y.Doc 스냅샷 저장 완료: diagramId={}, size={}bytes, snapshotRevision={}",
            diagramId,
            combined.length,
            contentRevision
        );
    }

    /**
     * 클라이언트가 보낸 전체 상태로 persisted snapshot을 즉시 교체한다.
     *
     * @param diagramId 다이어그램 ID
     * @param expectedContentRevision 기대 contentRevision
     * @param fullStateUpdate 전체 Y.Doc 상태 update
     * @param persistOnlyIfMissing 기존 snapshot이 없을 때만 저장할지 여부
     * @return 저장 성공 여부
     */
    boolean replaceSnapshotWithClientState(
        Long diagramId,
        String expectedContentRevision,
        byte[] fullStateUpdate,
        boolean persistOnlyIfMissing
    ) {
        if (fullStateUpdate == null || fullStateUpdate.length == 0) {
            return false;
        }

        final var contentRevision = diagramRepository.findContentRevisionForUpdate(diagramId);
        if (contentRevision == null) {
            log.warn("클라이언트 snapshot 저장 실패: 다이어그램 미존재 (id={})", diagramId);
            return false;
        }
        if (!String.valueOf(contentRevision).equals(expectedContentRevision)) {
            throw new ConflictException(MessageCode.ERROR_BUSINESS_DIAGRAM_SNAPSHOT_STALE.code());
        }
        if (persistOnlyIfMissing && diagramRepository.findYdocSnapshotById(diagramId).orElse(new byte[0]).length > 0) {
            return false;
        }

        final var snapshot = encodingSupport.encodeSingleUpdate(fullStateUpdate);
        final var updated = diagramRepository.updateYdocSnapshotAndRevisionById(diagramId, snapshot, contentRevision);
        if (updated == 0) {
            log.warn("클라이언트 snapshot 저장 실패: UPDATE 실패 (id={})", diagramId);
            return false;
        }

        cacheSupport.cacheSnapshot(diagramId, snapshot);
        roomManager.replaceUpdates(diagramId, fullStateUpdate);
        log.info(
            "클라이언트 Y.Doc 스냅샷 저장 완료: diagramId={}, size={}bytes, snapshotRevision={}",
            diagramId,
            snapshot.length,
            contentRevision
        );
        return true;
    }
}
