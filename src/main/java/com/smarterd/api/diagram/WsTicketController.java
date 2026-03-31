package com.smarterd.api.diagram;

import com.smarterd.api.diagram.dto.WsTicketRequest;
import com.smarterd.api.diagram.dto.WsTicketResponse;
import com.smarterd.application.diagram.command.IssueDiagramCollaborationTicketUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WebSocket 일회용 ticket 발급 컨트롤러.
 *
 * <p>JWT 인증된 사용자가 다이어그램 접속 전 일회용 ticket을 발급받는다.
 * 사용자/다이어그램 검증은 Service에 위임한다.</p>
 */
@RestController
@RequestMapping("/api/ws-ticket")
@RequiredArgsConstructor
public class WsTicketController {

    /** 협업 ticket 발급 유스케이스 */
    private final IssueDiagramCollaborationTicketUseCase issueDiagramCollaborationTicketUseCase;

    /**
     * WebSocket 일회용 ticket을 발급한다.
     *
     * @param jwt     JWT 인증 정보
     * @param request ticket 발급 요청 (다이어그램 ID)
     * @return ticket 응답
     */
    @PostMapping
    public WsTicketResponse issueTicket(@AuthenticationPrincipal Jwt jwt, @RequestBody @Valid WsTicketRequest request) {
        final var loginId = jwt.getSubject();
        final var result = issueDiagramCollaborationTicketUseCase.execute(loginId, request.diagramId());
        return new WsTicketResponse(result.ticket(), result.userId(), result.presenceProtocolVersion());
    }
}
