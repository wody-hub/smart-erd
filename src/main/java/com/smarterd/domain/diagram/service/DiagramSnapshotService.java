package com.smarterd.domain.diagram.service;

import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.repository.SnapshotWithRevision;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.Optional;
import org.springframework.context.SmartLifecycle;
import org.springframework.lang.NonNull;
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
 *
 * <p>{@link SmartLifecycle}을 구현하여 서버 종료 시 인메모리 누적 update를
 * DB에 안전하게 저장한다.</p>
 */
@Service
@Transactional(readOnly = true)
public class DiagramSnapshotService implements SmartLifecycle {

    private final DiagramSnapshotCacheSupport cacheSupport;
    private final DiagramSnapshotPersistenceSupport persistenceSupport;
    private final DiagramRealtimeSnapshotStateSupport realtimeStateSupport;
    private final DiagramSnapshotCompactionSupport compactionSupport;
    private final DiagramSnapshotFlushSupport flushSupport;
    private final DiagramSnapshotLifecycleSupport lifecycleSupport;

    /**
     * @param diagramRepository 다이어그램 레포지토리
     * @param webSocketProperties WebSocket 설정 프로퍼티
     * @param roomManager 방 관리자
     * @param transactionTemplate 다이어그램별 트랜잭션 실행 객체
     */
    public DiagramSnapshotService(
        DiagramRepository diagramRepository,
        WebSocketProperties webSocketProperties,
        DiagramRoomManager roomManager,
        TransactionTemplate transactionTemplate
    ) {
        final var encodingSupport = new DiagramSnapshotEncodingSupport();
        this.cacheSupport = new DiagramSnapshotCacheSupport(diagramRepository, encodingSupport);
        this.compactionSupport = new DiagramSnapshotCompactionSupport(diagramRepository, cacheSupport, encodingSupport);
        this.persistenceSupport = new DiagramSnapshotPersistenceSupport(
            diagramRepository,
            roomManager,
            cacheSupport,
            encodingSupport
        );
        this.realtimeStateSupport = new DiagramRealtimeSnapshotStateSupport(
            roomManager,
            cacheSupport,
            compactionSupport
        );
        this.flushSupport = new DiagramSnapshotFlushSupport(
            diagramRepository,
            roomManager,
            transactionTemplate,
            cacheSupport
        );
        this.lifecycleSupport = new DiagramSnapshotLifecycleSupport(
            webSocketProperties,
            flushSupport,
            compactionSupport
        );
    }

    /**
     * 누적된 Yjs update를 기존 DB 스냅샷에 연결하여 저장한다.
     * 마지막 사용자 퇴장 시 호출된다.
     *
     * @param diagramId      다이어그램 ID
     * @param mergedUpdates  병합된 Yjs update 바이트 배열
     */
    @Transactional
    public void saveSnapshotWithUpdates(Long diagramId, byte[] mergedUpdates) {
        persistenceSupport.saveSnapshotWithUpdates(diagramId, mergedUpdates);
    }

    /**
     * DB에서 Y.Doc 스냅샷을 로드한다.
     * 프로젝션 쿼리로 ydocSnapshot만 조회하여 불필요한 content TEXT 로딩을 방지한다.
     *
     * @param diagramId 다이어그램 ID
     * @return Y.Doc 스냅샷 바이트 배열, 없으면 빈 배열
     */
    public byte[] loadSnapshot(Long diagramId) {
        return cacheSupport.loadSnapshot(diagramId);
    }

    /**
     * 최근 persisted snapshot 캐시를 조회한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 캐시된 snapshot. 없으면 빈 Optional
     */
    public Optional<byte[]> getCachedSnapshot(Long diagramId) {
        return cacheSupport.getCachedSnapshot(diagramId);
    }

    /**
     * DB에서 Y.Doc 스냅샷과 snapshotRevision을 함께 로드한다.
     * v2 프로토콜에서 리비전 정보를 클라이언트에 전달하기 위해 사용한다.
     *
     * @param diagramId 다이어그램 ID
     * @return SnapshotWithRevision Optional
     */
    public Optional<SnapshotWithRevision> loadSnapshotWithRevision(Long diagramId) {
        return cacheSupport.loadSnapshotWithRevision(diagramId);
    }

    /**
     * 캐시된 persisted snapshot을 제거한다.
     *
     * <p>REST 저장 등으로 snapshot을 무효화한 직후 stale cache가 handoff에 재사용되지 않게 한다.</p>
     *
     * @param diagramId 다이어그램 ID
     */
    public void evictCachedSnapshot(Long diagramId) {
        cacheSupport.evictCachedSnapshot(diagramId);
    }

    /**
     * authoritative persisted 저장 이후 realtime 상태를 after-commit 시점에 정렬한다.
     *
     * <p>DB 커밋이 확정되기 전에 room/cache를 바꾸면 잠깐 동안 persisted와 handoff가 엇갈릴 수 있으므로
     * 정렬 자체는 커밋 이후에만 수행한다.</p>
     *
     * @param diagramId       다이어그램 ID
     * @param fullStateUpdate 저장 시점의 전체 Y.Doc 상태 update (없으면 null)
     */
    public void reconcileRealtimeStateWithPersistedContentAfterCommit(Long diagramId, byte[] fullStateUpdate) {
        realtimeStateSupport.reconcileAfterCommit(diagramId, fullStateUpdate);
    }

    /**
     * authoritative persisted 변경 후 stale realtime 상태를 after-commit 시점에 폐기한다.
     *
     * <p>사전 세트 변경/삭제처럼 기존 room 상태를 그대로 둘 수 없는 경로에서 사용한다.</p>
     *
     * @param diagramId 다이어그램 ID
     */
    public void discardRealtimeStateAfterCommit(Long diagramId) {
        realtimeStateSupport.discardAfterCommit(diagramId);
    }

    /**
     * REST 저장 이후 실시간 협업 상태를 최신 persisted 기준으로 정렬한다.
     *
     * <p>저장 시점의 전체 Y.Doc 상태가 있으면 cache/room 버퍼를 같은 기준으로 교체하고,
     * 없으면 stale snapshot/update가 다시 살아나지 않도록 비운다.</p>
     *
     * @param diagramId        다이어그램 ID
     * @param fullStateUpdate  저장 시점의 전체 Y.Doc 상태 update (없으면 null)
     */
    public void reconcileRealtimeStateWithPersistedContent(Long diagramId, byte[] fullStateUpdate) {
        realtimeStateSupport.reconcile(diagramId, fullStateUpdate);
    }

    /**
     * 클라이언트가 보낸 현재 Y.Doc 전체 상태로 persisted snapshot을 즉시 교체한다.
     *
     * <p>코드 모드의 shared draft가 페이지 이탈 직전에도 세션 간 복원될 수 있도록
     * keepalive 요청에서 사용한다.</p>
     *
     * @param diagramId               다이어그램 ID
     * @param expectedContentRevision 클라이언트가 기준으로 삼은 contentRevision
     * @param fullStateUpdate         클라이언트가 보낸 현재 Y.Doc 전체 상태 update
     * @param persistOnlyIfMissing    true면 기존 persisted snapshot이 없을 때만 저장한다.
     * @return 저장 성공 여부
     */
    @Transactional
    public boolean replaceSnapshotWithClientState(
        Long diagramId,
        String expectedContentRevision,
        byte[] fullStateUpdate,
        boolean persistOnlyIfMissing
    ) {
        return persistenceSupport.replaceSnapshotWithClientState(
            diagramId,
            expectedContentRevision,
            fullStateUpdate,
            persistOnlyIfMissing
        );
    }

    /**
     * 컴팩션된 스냅샷으로 기존 ydocSnapshot을 교체한다.
     * 크기 비교 검증을 수행하여 컴팩션 결과가 기존보다 큰 경우 거부한다.
     *
     * @param diagramId        다이어그램 ID
     * @param compactedUpdate  클라이언트가 전송한 컴팩션 바이트 (단일 Yjs update)
     * @return 교체 성공 여부
     */
    @Transactional
    public boolean replaceSnapshot(Long diagramId, byte[] compactedUpdate) {
        return compactionSupport.replaceSnapshot(diagramId, compactedUpdate);
    }

    /**
     * 해당 다이어그램이 컴팩션 쿨다운 상태인지 확인한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 쿨다운 중이면 true
     */
    public boolean isCompactionInCoolDown(Long diagramId) {
        return compactionSupport.isCompactionInCoolDown(diagramId);
    }

    /**
     * 해당 다이어그램의 컴팩션 쿨다운 상태를 초기화한다.
     * 방 폐기 시 호출한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void clearCompactionCoolDown(Long diagramId) {
        compactionSupport.clearCompactionCoolDown(diagramId);
    }

    /**
     * persisted snapshot과 아직 flush되지 않은 update를 합쳐 warm handoff payload를 만든다.
     *
     * @param diagramId 다이어그램 ID
     * @param mergedUpdates 인메모리 누적 update blob
     * @return handoff용 snapshot blob
     */
    public byte[] buildWarmHandoffSnapshot(Long diagramId, byte[] mergedUpdates) {
        return compactionSupport.buildWarmHandoffSnapshot(diagramId, mergedUpdates);
    }

    /**
     * 컴팩션 거부 시 쿨다운을 설정한다.
     * 동일 사용자 멀티 탭 등 단독 접속이 아닌 경우 반복 요청을 방지하기 위해 사용한다.
     *
     * @param diagramId 다이어그램 ID
     */
    public void setCompactionRejectCoolDown(Long diagramId) {
        compactionSupport.setCompactionRejectCoolDown(diagramId);
    }

    /**
     * 변경된 인메모리 누적 update를 주기적으로 DB에 저장한다.
     *
     * <p>{@code smart-erd.websocket.snapshot-flush-interval} 주기로 실행되며,
     * dirty 플래그가 설정된 다이어그램만 처리한다.</p>
     */
    @Scheduled(fixedDelayString = "${smart-erd.websocket.snapshot-flush-interval:5000}")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void flushDirtySnapshots() {
        flushSupport.flushDirtySnapshots();
    }

    /**
     * 특정 다이어그램의 누적 update를 즉시 DB 스냅샷으로 flush한다.
     *
     * <p>조회 직전/명시 저장 직후 정합성이 필요할 때 사용한다.
     * 누적 update가 없으면 no-op(false)를 반환한다.</p>
     *
     * @param diagramId 다이어그램 ID
     * @return flush 수행 여부 (true: 저장됨, false: 누적 update 없음 또는 실패)
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public boolean flushDiagramSnapshotNow(Long diagramId) {
        return flushSupport.flushSingleDiagram(diagramId);
    }

    @Override
    public void stop() {
        lifecycleSupport.stop();
    }

    @Override
    public void start() {
        lifecycleSupport.start();
    }

    @Override
    public boolean isRunning() {
        return lifecycleSupport.isRunning();
    }

    @Override
    public int getPhase() {
        return lifecycleSupport.getPhase();
    }

    @Override
    public void stop(@NonNull Runnable callback) {
        lifecycleSupport.stop(callback);
    }
}
