package com.smarterd.domain.diagram.websocket.relay.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageContext;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageHandler;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageSender;
import com.smarterd.domain.diagram.websocket.relay.DiagramMessageTypes;
import java.util.Arrays;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Awareness 메시지 처리기.
 *
 * <p>세션에 바인딩된 사용자 식별자와 payload 내부 사용자 식별자가 일치할 때만 relay한다.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AwarenessMessageHandler implements DiagramMessageHandler {

    private static final Set<Byte> SUPPORTED_TYPES = Set.of(DiagramMessageTypes.MSG_AWARENESS);

    private final ObjectMapper objectMapper;
    private final DiagramMessageSender messageSender;

    /**
     * {@inheritDoc}
     */
    @Override
    public Set<Byte> supportedTypes() {
        return SUPPORTED_TYPES;
    }

    /**
     * Awareness payload를 검증한 뒤 같은 room으로 relay한다.
     *
     * @param context 메시지 컨텍스트
     */
    @Override
    public void handle(DiagramMessageContext context) {
        final var sessionInfo = context.sessionInfo();
        if (isAwarenessValid(context.payload(), sessionInfo.loginId(), sessionInfo.userId())) {
            messageSender.broadcastToRoom(context.diagramId(), context.session(), context.message());
        }
    }

    /**
     * Awareness 메시지의 loginId/userId가 세션 정보와 일치하는지 검증한다.
     *
     * @param payload         전체 메시지 payload (타입 바이트 포함)
     * @param expectedLoginId 세션에서 인증된 loginId
     * @param expectedUserId  세션에서 인증된 userId
     * @return 검증 통과 여부
     */
    private boolean isAwarenessValid(byte[] payload, String expectedLoginId, String expectedUserId) {
        try {
            final var jsonBytes = Arrays.copyOfRange(payload, 1, payload.length);
            final var tree = objectMapper.readTree(jsonBytes);
            final var stateNode = tree.path("state");
            if (stateNode.isMissingNode() || stateNode.isNull()) {
                // Awareness null 전송 (정상 종료 시): 검증 통과
                return true;
            }
            final var userNode = stateNode.path("user");
            final var loginIdNode = userNode.path("loginId");
            if (!loginIdNode.isTextual() || !loginIdNode.textValue().equals(expectedLoginId)) {
                return false;
            }

            // userId가 함께 전송된 경우에는 userId까지 검증한다.
            final var userIdNode = userNode.path("userId");
            if (userIdNode.isTextual() && !userIdNode.textValue().equals(expectedUserId)) {
                return false;
            }
            return true;
        } catch (Exception e) {
            log.debug("Awareness 검증 실패", e);
            return false;
        }
    }
}
