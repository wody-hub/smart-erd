package com.smarterd.collaboration.channel;

import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;

/**
 * 채널별 접근/세션 유효성 검사를 수행하는 정책 포트.
 *
 * <p>1차 구현에서는 공통 계약만 고정하고, 실제 권한 검사는 기존 handshake/ticket 발급 경로가 담당한다.
 * 따라서 이 포트는 세션 메타데이터가 채널 계약과 호환되는지 재검증하는 용도로 먼저 사용한다.</p>
 */
@FunctionalInterface
public interface CollaborationAccessPolicy {

    /**
     * 세션이 특정 채널 리소스 계약과 호환되는지 검사한다.
     *
     * @param session 협업 인증 세션 메타데이터
     */
    void validateAccess(CollaborationAuthenticatedSession session);
}
