package com.smarterd.application.collaboration.command;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupportRegistry;
import com.smarterd.collaboration.channel.CollaborationTicketSupportRegistry;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 채널 ticket/runtime support 기준으로 WebSocket ticket을 검증하고 공통 세션 메타데이터를 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class ValidateCollaborationTicketUseCase {

    private final CollaborationTicketSupportRegistry collaborationTicketSupportRegistry;
    private final CollaborationRuntimeSupportRegistry collaborationRuntimeSupportRegistry;

    /**
     * ticket을 검증하고 요청한 리소스 key와 일치하는 협업 세션을 반환한다.
     *
     * @param ticket 검증할 ticket
     * @param requestedResourceKey 요청 경로가 가리키는 리소스 key
     * @param protocolVersion 클라이언트 프로토콜 버전
     * @return 검증 성공 시 협업 세션
     */
    public Optional<CollaborationAuthenticatedSession> validateAndConsume(
        String ticket,
        CollaborationResourceKey requestedResourceKey,
        int protocolVersion
    ) {
        final var ticketSupport = collaborationTicketSupportRegistry.getRequired(requestedResourceKey);
        final var runtimeSupport = collaborationRuntimeSupportRegistry.getRequired(requestedResourceKey);
        final var sessionOpt = ticketSupport.ticketAuthenticator().validateAndConsume(ticket, protocolVersion);
        if (sessionOpt.isEmpty()) {
            log.debug("WebSocket ticket 검증 실패: ticket consumed/expired (resourceKey={})", requestedResourceKey);
            return Optional.empty();
        }

        final var session = sessionOpt.get();
        try {
            runtimeSupport.accessPolicy().validateAccess(session);
        } catch (IllegalArgumentException e) {
            log.warn("WebSocket 접근 정책 검증 실패: resourceKey={}, reason={}", requestedResourceKey, e.getMessage());
            return Optional.empty();
        }

        if (!requestedResourceKey.equals(session.resourceKey())) {
            log.warn(
                "WebSocket resource key 불일치: requested={}, session={}",
                requestedResourceKey,
                session.resourceKey()
            );
            return Optional.empty();
        }

        return Optional.of(session);
    }
}
