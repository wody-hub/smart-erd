package com.smarterd.domain.diagram.websocket;

import com.smarterd.config.WebSocketProperties;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WebSocket 일회용 ticket 발급/검증 서비스.
 *
 * <p>JWT를 URL query param으로 직접 전달하는 대신, 서버에서 단기 유효(30초)
 * 일회용 ticket을 발급하고 WebSocket 핸드셰이크 시 검증한다.
 * ticket은 한 번 사용되면 즉시 소멸(consume)된다.</p>
 *
 * <p>ticket 저장소는 {@link WsTicketStore} 인터페이스를 통해 추상화되어
 * in-memory / Redis 구현체를 설정으로 전환할 수 있다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WsTicketService {

    private static final Logger log = LoggerFactory.getLogger(WsTicketService.class);

    /** ticket 유효 시간 (30초) */
    private static final Duration TICKET_TTL = Duration.ofSeconds(30);

    /** 사용자당 최대 미사용 ticket 수 */
    private static final int MAX_OUTSTANDING_TICKETS_PER_USER = 10;

    /** Presence 프로토콜 버전 */
    private static final int PRESENCE_PROTOCOL_VERSION = 1;

    /** WebSocket 설정 프로퍼티 */
    private final WebSocketProperties webSocketProperties;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;

    /** 팀 멤버 레포지토리 */
    private final TeamMemberRepository teamMemberRepository;

    /** ticket 저장소 */
    private final WsTicketStore wsTicketStore;

    /**
     * 사용자/다이어그램 검증 후 일회용 WebSocket ticket을 발급한다.
     *
     * <p>사용자 조회 → 다이어그램 fetch join → 팀 멤버십 검증 → ticket 발급.
     * 동일 (loginId, diagramId) 조합의 기존 ticket은 제거하고 새로 발급하며,
     * 사용자당 미사용 ticket 수가 상한을 초과하면 {@link BusinessException}을 발생시킨다.</p>
     *
     * @param loginId   JWT에서 추출한 사용자 로그인 ID
     * @param diagramId 접속 대상 다이어그램 ID
     * @return 발급된 ticket 문자열
     */
    public TicketIssueResult issueVerifiedTicket(String loginId, Long diagramId) {
        // 사용자 조회
        final var user = userRepository
            .findByLoginId(loginId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), loginId));

        // 다이어그램 → 프로젝트 → 팀 소속 확인 (fetch join으로 LAZY 문제 방지)
        final var diagram = diagramRepository
            .findByIdWithProjectAndTeam(diagramId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), diagramId));

        final var team = diagram.getProject().getTeam();
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
        }

        return issueTicket(String.valueOf(user.getId()), loginId, user.getName(), diagramId);
    }

    /**
     * 일회용 WebSocket ticket을 발급한다.
     *
     * <p>동일 (loginId, diagramId) 조합의 기존 ticket을 제거하고 새로 발급한다.
     * 사용자당 미사용 ticket 수가 상한({@value MAX_OUTSTANDING_TICKETS_PER_USER})을
     * 초과하면 {@link BusinessException}을 발생시킨다.</p>
     *
     * @param userId    사용자 ID (불변 식별자)
     * @param loginId   사용자 로그인 ID
     * @param userName  사용자 표시 이름
     * @param diagramId 접속 대상 다이어그램 ID
     * @return 발급된 ticket + 메타데이터
     */
    private TicketIssueResult issueTicket(String userId, String loginId, String userName, Long diagramId) {
        // 동일 (loginId, diagramId) 조합의 기존 ticket 제거
        wsTicketStore.removeByLoginIdAndDiagramId(loginId, diagramId);

        // 사용자별 미사용 ticket 수 상한 확인
        final var outstandingCount = wsTicketStore.countByLoginId(loginId);
        if (outstandingCount >= MAX_OUTSTANDING_TICKETS_PER_USER) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_TICKET_LIMIT_EXCEEDED.code());
        }

        final var ticket = UUID.randomUUID().toString();
        final var expiresAt = Instant.now().plus(TICKET_TTL);
        wsTicketStore.store(ticket, new TicketData(userId, loginId, userName, diagramId, expiresAt), TICKET_TTL);
        log.debug("WebSocket ticket 발급: loginId={}, diagramId={}", loginId, diagramId);
        return new TicketIssueResult(ticket, userId, PRESENCE_PROTOCOL_VERSION);
    }

    /**
     * ticket을 검증하고 소멸(consume)한다.
     *
     * <p>ticket이 유효하면 {@link WebSocketSessionInfo}를 생성하여 반환하고,
     * 즉시 삭제하여 재사용을 방지한다.</p>
     *
     * @param ticket 검증할 ticket 문자열
     * @return 검증 성공 시 세션 정보, 실패 시 empty
     */
    public Optional<WebSocketSessionInfo> validateAndConsume(String ticket) {
        return wsTicketStore
            .consume(ticket)
            .map((data) -> {
                final var sessionExpiresAt = Instant.now().plus(
                    Duration.ofMillis(webSocketProperties.getSessionMaxDuration())
                );
                return new WebSocketSessionInfo(
                    data.userId(),
                    data.loginId(),
                    data.userName(),
                    data.diagramId(),
                    sessionExpiresAt
                );
            });
    }

    /**
     * ticket 발급 결과.
     *
     * @param ticket                  발급된 일회용 ticket
     * @param userId                  사용자 ID (불변 식별자)
     * @param presenceProtocolVersion presence 프로토콜 버전
     */
    public record TicketIssueResult(String ticket, String userId, int presenceProtocolVersion) {}
}
