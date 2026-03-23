package com.smarterd.domain.diagram.websocket.session;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeys;
import java.time.Instant;

/**
 * WebSocket 세션에 저장하는 인증 메타데이터 record.
 *
 * <p>핸드셰이크 인터셉터에서 인증 후 세션 attributes에 저장하여
 * 핸들러에서 사용자 정보와 다이어그램 ID를 참조할 수 있게 한다.</p>
 *
 * @param userId          사용자 ID (불변 식별자)
 * @param loginId         사용자 로그인 ID
 * @param userName        사용자 표시 이름
 * @param diagramId       접속 대상 다이어그램 ID
 * @param expiresAt       세션 만료 시각
 * @param protocolVersion 클라이언트 프로토콜 버전 (1: 레거시, 2: 리비전 포함 바이너리)
 */
public record AuthenticatedSession(
    String userId,
    String loginId,
    String userName,
    Long diagramId,
    Instant expiresAt,
    int protocolVersion
) {
    /** 다이어그램 전용 세션 attributes에 저장할 legacy 키 */
    public static final String SESSION_ATTR_KEY = "wsDiagramSessionInfo";

    /**
     * 세션이 만료되었는지 확인한다.
     *
     * @return 만료 여부
     */
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    /**
     * diagram 세션 메타데이터를 공통 협업 세션 메타데이터로 변환한다.
     *
     * @return 공통 협업 세션 메타데이터
     */
    public CollaborationAuthenticatedSession toCollaborationSession() {
        return new CollaborationAuthenticatedSession(
            userId,
            loginId,
            userName,
            resourceKey(),
            expiresAt,
            protocolVersion
        );
    }

    /**
     * 다이어그램 세션이 가리키는 협업 리소스 key를 만든다.
     *
     * @return diagram 채널 리소스 key
     */
    public CollaborationResourceKey resourceKey() {
        return DiagramCollaborationResourceKeys.forDiagramId(diagramId);
    }

    /**
     * 공통 협업 세션 메타데이터를 다이어그램 전용 세션 메타데이터로 변환한다.
     *
     * @param session 공통 협업 세션 메타데이터
     * @return 다이어그램 전용 세션 메타데이터
     * @throws IllegalArgumentException diagram 채널이 아니거나 resourceId를 Long으로 해석할 수 없으면 예외
     */
    public static AuthenticatedSession fromCollaborationSession(CollaborationAuthenticatedSession session) {
        if (!DiagramCollaborationResourceKeyFactory.CHANNEL_TYPE.equals(session.resourceKey().channelType())) {
            throw new IllegalArgumentException(
                "다이어그램 세션으로 변환할 수 없는 채널 타입: " + session.resourceKey().channelType()
            );
        }

        return new AuthenticatedSession(
            session.userId(),
            session.loginId(),
            session.userName(),
            DiagramCollaborationResourceKeys.parseDiagramId(session.resourceKey()),
            session.expiresAt(),
            session.protocolVersion()
        );
    }
}
