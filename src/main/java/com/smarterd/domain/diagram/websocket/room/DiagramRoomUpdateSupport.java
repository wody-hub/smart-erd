package com.smarterd.domain.diagram.websocket.room;

import com.smarterd.config.websocket.WebSocketProperties;
import java.util.Set;

/**
 * 다이어그램 room의 Yjs update 누적/복원/dirty 상태 흐름을 담당한다.
 */
final class DiagramRoomUpdateSupport {

    private final WebSocketProperties webSocketProperties;
    private final DiagramSessionRegistry sessionRegistry;
    private final DiagramUpdateBuffer updateBuffer;

    /**
     * @param webSocketProperties WebSocket 설정
     * @param sessionRegistry 세션 저장소
     * @param updateBuffer update 누적 버퍼
     */
    DiagramRoomUpdateSupport(
        WebSocketProperties webSocketProperties,
        DiagramSessionRegistry sessionRegistry,
        DiagramUpdateBuffer updateBuffer
    ) {
        this.webSocketProperties = webSocketProperties;
        this.sessionRegistry = sessionRegistry;
        this.updateBuffer = updateBuffer;
    }

    /**
     * Yjs update를 누적 리스트에 추가한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update 순수 Yjs update 바이트 배열
     * @return 추가 성공 여부
     */
    boolean appendUpdate(Long diagramId, byte[] update) {
        synchronized (getFlushLock(diagramId)) {
            return updateBuffer.appendUpdate(diagramId, update, webSocketProperties.getMaxAccumulatedUpdatesSize());
        }
    }

    /**
     * 단독 접속 상태일 때만 누적 update를 drain한다.
     *
     * @param diagramId 다이어그램 ID
     * @return drain된 update. 단독 접속이 아니면 {@code null}
     */
    byte[] drainIfAlone(Long diagramId) {
        final var sessions = sessionRegistry.getSessions(diagramId);
        if (sessions == null) {
            return null;
        }
        synchronized (sessions) {
            if (sessions.size() != 1) {
                return null;
            }
            return updateBuffer.drainAndMergeUpdates(diagramId);
        }
    }

    /**
     * 누적된 Yjs update를 drain하고 병합한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 병합된 바이트 배열
     */
    byte[] drainAndMergeUpdates(Long diagramId) {
        return updateBuffer.drainAndMergeUpdates(diagramId);
    }

    /**
     * 현재 누적 update를 비우지 않고 병합한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 병합된 바이트 배열
     */
    byte[] peekMergedUpdates(Long diagramId) {
        synchronized (getFlushLock(diagramId)) {
            return updateBuffer.peekMergedUpdates(diagramId);
        }
    }

    /**
     * drain된 update를 인메모리 버퍼에 복원한다.
     *
     * @param diagramId 다이어그램 ID
     * @param mergedUpdates drain된 병합 바이트 배열
     * @return 복원 성공 여부
     */
    boolean restoreUpdates(Long diagramId, byte[] mergedUpdates) {
        synchronized (getFlushLock(diagramId)) {
            return updateBuffer.restoreUpdates(
                diagramId,
                mergedUpdates,
                webSocketProperties.getMaxAccumulatedUpdatesSize()
            );
        }
    }

    /**
     * 누적 update 버퍼를 최신 단일 update 기준으로 교체한다.
     *
     * @param diagramId 다이어그램 ID
     * @param update 최신 전체 상태를 나타내는 raw Yjs update
     */
    void replaceUpdates(Long diagramId, byte[] update) {
        synchronized (getFlushLock(diagramId)) {
            updateBuffer.replaceWithSingleUpdate(diagramId, update);
        }
    }

    /**
     * 누적 update 존재 여부를 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return 누적 update 존재 여부
     */
    boolean hasUpdates(Long diagramId) {
        return updateBuffer.hasUpdates(diagramId);
    }

    /**
     * 다이어그램을 다시 dirty 상태로 표시한다.
     *
     * @param diagramId 다이어그램 ID
     */
    void reDirty(Long diagramId) {
        updateBuffer.reDirty(diagramId);
    }

    /**
     * dirty 다이어그램 ID를 반환하고 dirty 상태를 초기화한다.
     *
     * @return dirty 다이어그램 ID 집합
     */
    Set<Long> getDirtyIdsAndClear() {
        return updateBuffer.getDirtyIdsAndClear();
    }

    /**
     * 누적 update가 존재하는 모든 다이어그램 ID를 반환한다.
     *
     * @return 누적 update가 있는 다이어그램 ID 집합
     */
    Set<Long> getAllDiagramIdsWithUpdates() {
        return updateBuffer.getAllDiagramIdsWithUpdates();
    }

    /**
     * 다이어그램별 flush 락을 반환한다.
     *
     * @param diagramId 다이어그램 ID
     * @return flush 락
     */
    private Object getFlushLock(Long diagramId) {
        return sessionRegistry.getFlushLock(diagramId);
    }
}
