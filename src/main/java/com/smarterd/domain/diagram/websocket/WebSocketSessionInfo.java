package com.smarterd.domain.diagram.websocket;

/**
 * WebSocket 세션에 저장하는 메타데이터 record.
 *
 * <p>JWT 핸드셰이크 인터셉터에서 인증 후 세션 attributes에 저장하여
 * 핸들러에서 사용자 정보와 다이어그램 ID를 참조할 수 있게 한다.</p>
 *
 * @param loginId   사용자 로그인 ID (JWT subject)
 * @param userName  사용자 표시 이름
 * @param diagramId 접속 대상 다이어그램 ID
 */
public record WebSocketSessionInfo(String loginId, String userName, Long diagramId) {
    /** 세션 attributes에 저장할 키 */
    public static final String SESSION_ATTR_KEY = "wsSessionInfo";
}
