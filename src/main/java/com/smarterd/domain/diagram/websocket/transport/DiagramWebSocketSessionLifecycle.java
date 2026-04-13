package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.application.diagram.command.CompleteDiagramSessionJoinUseCase;
import com.smarterd.application.diagram.command.CompleteDiagramSessionLeaveUseCase;
import com.smarterd.application.diagram.port.DiagramSessionRef;
import com.smarterd.domain.diagram.websocket.mapper.DiagramApplicationPayloadMapper;
import com.smarterd.domain.diagram.websocket.model.JoinResult;
import com.smarterd.domain.diagram.websocket.session.DiagramWebSocketSessionInfo;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

/**
 * 다이어그램 WebSocket 세션의 join/leave/flush 수명주기를 관리한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiagramWebSocketSessionLifecycle {

    /** 다이어그램 세션 입장/퇴장 transport 유스케이스 */
    private final DiagramSessionTransportUseCase diagramSessionTransportUseCase;

    /** 다이어그램 세션 입장 완료 유스케이스 */
    private final CompleteDiagramSessionJoinUseCase completeDiagramSessionJoinUseCase;

    /** 다이어그램 세션 퇴장 완료 유스케이스 */
    private final CompleteDiagramSessionLeaveUseCase completeDiagramSessionLeaveUseCase;

    /** 레거시 presence 브로드캐스트 포트 */
    private final DiagramLegacyPresencePort diagramLegacyPresencePort;

    /**
     * 세션을 방에 입장시키고 presence 초기 메시지를 전송한다.
     *
     * @param session WebSocket 세션
     * @param info 정규화된 세션 메타데이터
     */
    public void establish(WebSocketSession session, DiagramWebSocketSessionInfo info) {
        final var joinResult = diagramSessionTransportUseCase.join(
            session,
            info.diagramId(),
            info.userId(),
            info.userName()
        );
        if (!joinResult.accepted()) {
            try {
                final var rejectionReason = joinResult.rejectionReason();
                final var closeCode =
                    rejectionReason != null ? rejectionReason.closeCode() : CloseStatus.POLICY_VIOLATION.getCode();
                final var closeReason = rejectionReason != null ? rejectionReason.closeReason() : "policy-violation";
                log.warn(
                    "WebSocket room join 거부 후 세션 종료 (session={}, diagramId={}, userId={}, code={}, reason={})",
                    session.getId(),
                    info.diagramId(),
                    info.userId(),
                    closeCode,
                    closeReason
                );
                session.close(new CloseStatus(closeCode, closeReason));
            } catch (Exception e) {
                log.warn("방 입장 거부 후 세션 종료 실패", e);
            }
            return;
        }
        completeDiagramSessionJoinUseCase.complete(
            new DiagramSessionRef(session.getId()),
            info.diagramId(),
            DiagramApplicationPayloadMapper.toJoinCompletion(joinResult)
        );
    }

    /**
     * 세션 종료 시 room leave, presence 정리, drain flush를 수행한다.
     *
     * @param session WebSocket 세션
     * @param info 세션 메타데이터. 없으면 roomManager 조회 결과로 보완한다.
     */
    public void close(WebSocketSession session, @Nullable DiagramWebSocketSessionInfo info) {
        final var closeResult = diagramSessionTransportUseCase.close(
            session,
            info != null ? info.diagramId() : null,
            info != null ? info.userId() : null
        );
        if (closeResult == null) {
            log.warn("WebSocket 세션 메타데이터/room 조회 실패로 종료 정리 생략 (세션 {})", session.getId());
            return;
        }
        completeDiagramSessionLeaveUseCase.complete(
            new DiagramSessionRef(session.getId()),
            Objects.requireNonNull(closeResult.diagramId()),
            DiagramApplicationPayloadMapper.toLeaveCompletion(closeResult.leaveResult())
        );
        if (
            info != null &&
            info.loginId() != null &&
            closeResult.leaveResult().leftUserId() != null &&
            closeResult.leaveResult().roomEpoch() != null
        ) {
            diagramLegacyPresencePort.broadcastPeerLeftLegacy(
                Objects.requireNonNull(closeResult.diagramId()),
                new DiagramSessionRef(session.getId()),
                info.loginId()
            );
        }
    }
}
