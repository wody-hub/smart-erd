package com.smarterd.domain.diagram.websocket.transport;

import com.smarterd.domain.diagram.websocket.session.AuthenticatedSession;
import com.smarterd.domain.diagram.websocket.ticket.WsTicketService;
import com.smarterd.utils.AppStringUtils;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * WebSocket 핸드셰이크 시 일회용 ticket을 검증하는 인터셉터.
 *
 * <p>WebSocket 연결 URL: {@code /ws/diagram/{diagramId}?ticket=TICKET}
 * <ol>
 *   <li>query param {@code ticket}에서 일회용 ticket을 추출</li>
 *   <li>{@link WsTicketService}로 ticket 검증 및 소멸(consume)</li>
 *   <li>ticket의 다이어그램 ID와 URL 경로의 다이어그램 ID 일치 확인</li>
 *   <li>{@link AuthenticatedSession}를 세션 attributes에 저장</li>
 * </ol></p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WsTicketHandshakeInterceptor implements HandshakeInterceptor {

    /** WebSocket 경로 패턴 매칭용 */
    private static final AntPathMatcher pathMatcher = new AntPathMatcher();

    /** ticket 발급/검증 서비스 */
    private final WsTicketService wsTicketService;

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
                log.warn("WebSocket 핸드셰이크 실패: ticket 파라미터 없음");
                return false;
            }

            // URL 경로에서 diagramId 추출 (/ws/diagram/{diagramId})
            final var path = Objects.requireNonNull(uri.getPath());
            if (!pathMatcher.match("/ws/diagram/{diagramId}", path)) {
                log.warn("WebSocket 핸드셰이크 실패: 잘못된 경로 {}", path);
                return false;
            }
            final var vars = pathMatcher.extractUriTemplateVariables("/ws/diagram/{diagramId}", path);
            final var diagramId = Long.parseLong(vars.get("diagramId"));

            // 2. ticket 검증 및 소멸
            final var sessionInfoOpt = wsTicketService.validateAndConsume(ticket);
            if (sessionInfoOpt.isEmpty()) {
                log.warn("WebSocket 핸드셰이크 실패: ticket 검증 실패");
                return false;
            }
            final var sessionInfo = sessionInfoOpt.get();

            // 3. URL 경로의 diagramId와 ticket의 diagramId 일치 확인
            if (!sessionInfo.diagramId().equals(diagramId)) {
                log.warn(
                    "WebSocket 핸드셰이크 실패: diagramId 불일치 (URL={}, ticket={})",
                    diagramId,
                    sessionInfo.diagramId()
                );
                return false;
            }

            // 4. protocolVersion 파싱 (1 또는 2만 허용, 그 외 1로 강등)
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

            // 5. protocolVersion을 포함한 세션 정보로 재구성하여 attributes에 저장
            final var enrichedSession = new AuthenticatedSession(
                sessionInfo.userId(),
                sessionInfo.loginId(),
                sessionInfo.userName(),
                sessionInfo.diagramId(),
                sessionInfo.expiresAt(),
                protocolVersion
            );
            attributes.put(AuthenticatedSession.SESSION_ATTR_KEY, enrichedSession);

            log.info(
                "WebSocket 핸드셰이크 성공: loginId={}, diagramId={}, protocolVersion={}",
                enrichedSession.loginId(),
                diagramId,
                enrichedSession.protocolVersion()
            );
            return true;
        } catch (NumberFormatException e) {
            log.warn("WebSocket 핸드셰이크 실패: diagramId 파싱 오류", e);
            return false;
        }
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
