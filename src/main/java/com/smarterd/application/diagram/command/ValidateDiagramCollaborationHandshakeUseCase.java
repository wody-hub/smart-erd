package com.smarterd.application.diagram.command;

import com.smarterd.application.collaboration.command.ValidateCollaborationTicketUseCase;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 WebSocket handshake의 path parsing + ticket validation을 묶는 유스케이스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ValidateDiagramCollaborationHandshakeUseCase {

    private final ValidateCollaborationTicketUseCase validateCollaborationTicketUseCase;
    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * handshake 요청을 검증하고 다이어그램 세션 결과를 반환한다.
     *
     * @param path 요청 경로
     * @param ticket 일회용 ticket
     * @param protocolVersion 클라이언트 프로토콜 버전
     * @return 검증 성공 시 세션/diagramId 결과
     */
    public Optional<DiagramHandshakeValidationResult> validate(
        String path,
        String ticket,
        int protocolVersion
    ) {
        final var requestedResourceKey = parseResourceKey(path);
        if (requestedResourceKey == null) {
            return Optional.empty();
        }

        return validateCollaborationTicketUseCase.validateAndConsume(ticket, requestedResourceKey, protocolVersion)
            .map((session) -> new DiagramHandshakeValidationResult(
                session,
                resourceKeyFactory.parseDiagramId(requestedResourceKey)
            ));
    }

    private com.smarterd.collaboration.channel.CollaborationResourceKey parseResourceKey(String path) {
        try {
            return resourceKeyFactory.fromWebSocketPath(path);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
