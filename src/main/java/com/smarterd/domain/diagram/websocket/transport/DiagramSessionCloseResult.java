package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.domain.diagram.websocket.model.LeaveResult;

/**
 * WebSocket 세션 종료 정리 후속 처리에 필요한 room leave 결과.
 *
 * @param diagramId 다이어그램 ID
 * @param leaveResult room leave 결과
 */
public record DiagramSessionCloseResult(Long diagramId, LeaveResult leaveResult) {}
