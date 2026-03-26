package com.smarterd.application.diagram.command;

import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;

/**
 * 다이어그램 WebSocket handshake 검증 성공 결과.
 *
 * @param session 공통 협업 세션 메타데이터
 * @param diagramId 요청 경로가 가리키는 다이어그램 ID
 */
public record DiagramHandshakeValidationResult(CollaborationAuthenticatedSession session, Long diagramId) {}
