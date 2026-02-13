package com.smarterd.domain.diagram.websocket.session;

import java.time.Instant;

/**
 * WebSocket 세션에 저장하는 인증 메타데이터 record.
 *
 * <p>핸드셰이크 인터셉터에서 인증 후 세션 attributes에 저장하여
 * 핸들러에서 사용자 정보와 다이어그램 ID를 참조할 수 있게 한다.</p>
 *
 * @param userId    사용자 ID (불변 식별자)
 * @param loginId   사용자 로그인 ID
 * @param userName  사용자 표시 이름
 * @param diagramId 접속 대상 다이어그램 ID
 * @param expiresAt 세션 만료 시각
 */
public record AuthenticatedSession(String userId, String loginId, String userName, Long diagramId, Instant expiresAt) {
    /** 세션 attributes에 저장할 키 */
    public static final String SESSION_ATTR_KEY = "wsSessionInfo";

    /**
     * 세션이 만료되었는지 확인한다.
     *
     * @return 만료 여부
     */
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
