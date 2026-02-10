package com.smarterd.domain.diagram.websocket;

import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * WebSocket 핸드셰이크 시 JWT 인증 및 팀 멤버십을 검증하는 인터셉터.
 *
 * <p>WebSocket 연결 URL: {@code /ws/diagram/{diagramId}?token=JWT}
 * <ol>
 *   <li>query param {@code token}에서 JWT를 추출하여 검증</li>
 *   <li>JWT subject(loginId)로 사용자 조회</li>
 *   <li>다이어그램 → 프로젝트 → 팀 소속 여부 확인</li>
 *   <li>{@link WebSocketSessionInfo}를 세션 attributes에 저장</li>
 * </ol></p>
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    /** WebSocket 경로 패턴 매칭용 */
    private static final AntPathMatcher pathMatcher = new AntPathMatcher();

    /** JWT 디코더 (Spring Security OAuth2 Resource Server) */
    private final JwtDecoder jwtDecoder;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;

    /** 팀 멤버 레포지토리 */
    private final TeamMemberRepository teamMemberRepository;

    /**
     * 핸드셰이크 전 JWT 인증 및 접근 권한을 검증한다.
     *
     * @param request    HTTP 요청
     * @param response   HTTP 응답
     * @param wsHandler  WebSocket 핸들러
     * @param attributes 세션 attributes (인증 정보 저장 대상)
     * @return 인증·권한 검증 성공 시 true, 실패 시 false
     */
    @Override
    @SuppressWarnings("null")
    public boolean beforeHandshake(
        @NonNull ServerHttpRequest request,
        @NonNull ServerHttpResponse response,
        @NonNull WebSocketHandler wsHandler,
        @NonNull Map<String, Object> attributes
    ) {
        try {
            // 1. URL에서 token과 diagramId 추출
            final var uri = request.getURI();
            final var queryParams = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
            final var token = queryParams.getFirst("token");
            if (token == null || token.isBlank()) {
                log.warn("WebSocket 핸드셰이크 실패: token 파라미터 없음");
                return false;
            }

            // URL 경로에서 diagramId 추출 (/ws/diagram/{diagramId})
            final var path = uri.getPath();
            if (!pathMatcher.match("/ws/diagram/{diagramId}", path)) {
                log.warn("WebSocket 핸드셰이크 실패: 잘못된 경로 {}", path);
                return false;
            }
            final var vars = pathMatcher.extractUriTemplateVariables("/ws/diagram/{diagramId}", path);
            final var diagramId = Long.parseLong(vars.get("diagramId"));

            // 보안 주의: JWT가 URL query param으로 전달됨. 서버 접근 로그/프록시 로그에 토큰이 노출될 수 있음.
            // WebSocket API는 커스텀 헤더를 지원하지 않으므로 현재 불가피한 방식.
            // 중장기적으로 일회용 ticket 패턴 도입 권장.
            if (log.isDebugEnabled()) {
                log.debug("WebSocket 핸드셰이크: JWT query param 인증 사용 (diagramId={})", diagramId);
            }

            // 2. JWT 검증
            final var jwt = jwtDecoder.decode(token);
            final var loginId = jwt.getSubject();

            // 3. 사용자 조회
            final var optionalUser = userRepository.findByLoginId(loginId);
            if (optionalUser.isEmpty()) {
                log.warn("WebSocket 핸드셰이크 실패: 사용자 미존재 (loginId={})", loginId);
                return false;
            }
            final var user = optionalUser.get();

            // 4. 다이어그램 → 프로젝트 → 팀 소속 확인 (fetch join으로 LAZY 문제 방지)
            final var optionalDiagram = diagramRepository.findByIdWithProjectAndTeam(diagramId);
            if (optionalDiagram.isEmpty()) {
                log.warn("WebSocket 핸드셰이크 실패: 다이어그램 미존재 (id={})", diagramId);
                return false;
            }
            final var diagram = optionalDiagram.get();

            final var team = diagram.getProject().getTeam();
            if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
                log.warn("WebSocket 핸드셰이크 실패: 팀 미소속 (loginId={}, teamId={})", loginId, team.getId());
                return false;
            }

            // 5. 세션 attributes에 메타데이터 저장
            final var sessionInfo = new WebSocketSessionInfo(loginId, user.getName(), diagramId);
            attributes.put(WebSocketSessionInfo.SESSION_ATTR_KEY, sessionInfo);

            log.info("WebSocket 핸드셰이크 성공: loginId={}, diagramId={}", loginId, diagramId);
            return true;
        } catch (JwtException e) {
            // 토큰 만료 등 정상적인 재인증 흐름에서도 발생하므로 스택 트레이스 없이 메시지만 기록
            log.warn("WebSocket 핸드셰이크 실패: JWT 검증 오류 — {}", e.getMessage());
            return false;
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
