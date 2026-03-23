package com.smarterd.collaboration.session;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import java.time.Instant;

/**
 * 핸드셰이크 이후 WebSocket 세션에 저장하는 공통 협업 인증 메타데이터.
 *
 * <p>기존 diagram 전용 {@code AuthenticatedSession}을 대체할 목표 타입이지만,
 * 1차에서는 기존 타입과 병행하며 공통 의미를 먼저 고정한다.</p>
 *
 * @param userId          사용자 불변 식별자
 * @param loginId         사용자 로그인 ID
 * @param userName        사용자 표시 이름
 * @param resourceKey     협업 채널 리소스 key
 * @param expiresAt       세션 만료 시각
 * @param protocolVersion 클라이언트 프로토콜 버전
 */
public record CollaborationAuthenticatedSession(
    String userId,
    String loginId,
    String userName,
    CollaborationResourceKey resourceKey,
    Instant expiresAt,
    int protocolVersion
) {
    /** WebSocket 세션 attributes에 저장하는 표준 키 */
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
