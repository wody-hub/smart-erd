package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.application.diagram.command.ValidateDiagramCollaborationHandshakeUseCase;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.utils.AppStringUtils;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * WebSocket 핸드셰이크 시 일회용 ticket을 검증하는 인터셉터.
 *
 * <p>WebSocket 연결 URL: {@code /ws/diagram/{diagramId}?ticket=TICKET}
 * <ol>
 *   <li>query param {@code ticket}에서 일회용 ticket을 추출</li>
 *   <li>application 유스케이스로 ticket 검증/소멸 및 resource key 일치 확인</li>
 *   <li>{@link CollaborationAuthenticatedSession}를 세션 attributes에 저장</li>
 * </ol></p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WsTicketHandshakeInterceptor implements HandshakeInterceptor {

    /** 다이어그램 handshake 검증 유스케이스 */
    private final ValidateDiagramCollaborationHandshakeUseCase validateDiagramCollaborationHandshakeUseCase;

    /**
     * 핸드셰이크 전 ticket 검증을 수행한다.
     *
     * @param request    HTTP 요청
     * @param response   HTTP 응답
     * @param wsHandler  WebSocket 핸들러
     * @param attributes 세션 attributes (인증 정보 저장 대상)
     * @return 검증 성공 시 true, 실패 시 false
     */
    @Override
    public boolean beforeHandshake(
        @NonNull ServerHttpRequest request,
        @NonNull ServerHttpResponse response,
        @NonNull WebSocketHandler wsHandler,
        @NonNull Map<String, Object> attributes
    ) {
        try {
            // 1. URL에서 ticket과 diagramId 추출
            final var uri = request.getURI();
            final var queryParams = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
            final var ticket = queryParams.getFirst("ticket");
            if (AppStringUtils.isBlank(ticket)) {
                log.warn("WebSocket 핸드셰이크 실패: ticket 파라미터 없음 (path={})", uri.getPath());
                rejectHandshake(response);
                return false;
            }

            // URL 경로에서 diagram resource key 추출
            final var path = Objects.requireNonNull(uri.getPath());
            // 2. protocolVersion 파싱 (1 또는 2만 허용, 그 외 1로 강등)
            var protocolVersion = 1;
            final var pvParam = queryParams.getFirst("protocolVersion");
            if (pvParam != null) {
                try {
                    final var parsed = Integer.parseInt(pvParam);
                    if (parsed == 2) {
                        protocolVersion = 2;
                    } else if (parsed != 1) {
                        log.warn("WebSocket 핸드셰이크: 미지원 protocolVersion={}, 1로 강등", parsed);
                    }
                } catch (NumberFormatException e) {
                    log.warn("WebSocket 핸드셰이크: protocolVersion 파싱 실패 '{}', 1로 강등", pvParam);
                }
            }

            // 3. path parsing + ticket 검증 + resource key 일치 확인
            final var validationResultOpt = validateDiagramCollaborationHandshakeUseCase.validate(
                path,
                ticket,
                protocolVersion
            );
            if (validationResultOpt.isEmpty()) {
                log.warn(
                    "WebSocket 핸드셰이크 실패: ticket 검증 실패 (path={}, ticketPrefix={})",
                    path,
                    ticket.length() > 8 ? ticket.substring(0, 8) + "..." : ticket
                );
                rejectHandshake(response);
                return false;
            }
            final var validationResult = validationResultOpt.get();
            final var sessionInfo = validationResult.session();

            // 4. 공통 세션 메타데이터 저장
            attributes.put(CollaborationAuthenticatedSession.SESSION_ATTR_KEY, sessionInfo);

            log.info(
                "WebSocket 핸드셰이크 성공: loginId={}, diagramId={}, protocolVersion={}",
                sessionInfo.loginId(),
                validationResult.diagramId(),
                sessionInfo.protocolVersion()
            );
            return true;
        } catch (NumberFormatException e) {
            log.warn("WebSocket 핸드셰이크 실패: diagramId 파싱 오류", e);
            rejectHandshake(response);
            return false;
        }
    }

    /**
     * 핸드셰이크 거부 시 HTTP 403 상태 코드를 명시적으로 설정한다.
     *
     * <p>Spring의 {@code WebSocketHttpRequestHandler}는 {@code beforeHandshake()}가 false를
     * 반환하면 응답 상태를 설정하지 않아 기본값 200 OK가 남는다.
     * 이로 인해 브라우저가 "Unexpected response code: 200" 에러를 표시하므로,
     * 명시적으로 403을 설정하여 클라이언트가 인증 실패를 올바르게 감지할 수 있게 한다.</p>
     *
     * @param response HTTP 응답
     */
    private void rejectHandshake(ServerHttpResponse response) {
        response.setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Override
    public void afterHandshake(
        @NonNull ServerHttpRequest request,
        @NonNull ServerHttpResponse response,
        @NonNull WebSocketHandler wsHandler,
        @Nullable Exception exception
    ) {
        // 후처리 불필요
    }
}
