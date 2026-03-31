package com.smarterd.collaboration.channel;

import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import java.util.Optional;

/**
 * 채널별 WebSocket ticket 검증/소멸 정책.
 */
public interface CollaborationTicketAuthenticator {
    /**
     * ticket을 검증하고 세션 메타데이터로 변환한다.
     *
     * @param ticket 검증할 ticket
     * @param protocolVersion 클라이언트 프로토콜 버전
     * @return 검증 성공 시 협업 인증 세션
     */
    Optional<CollaborationAuthenticatedSession> validateAndConsume(String ticket, int protocolVersion);
}
