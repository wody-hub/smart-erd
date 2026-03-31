package com.smarterd.application.diagram.command;

import com.smarterd.application.collaboration.command.IssueCollaborationTicketUseCase;
import com.smarterd.collaboration.channel.CollaborationTicketIssueResult;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 채널 협업 ticket 발급 유스케이스.
 *
 * <p>diagram 전용 API 진입점이 공통 채널 레지스트리/플러그인 세부사항을 직접 모르도록,
 * 다이어그램 리소스 key 생성과 공통 ticket 발급 orchestration을 application 계층에서 묶는다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IssueDiagramCollaborationTicketUseCase {

    private final IssueCollaborationTicketUseCase issueCollaborationTicketUseCase;
    private final DiagramCollaborationResourceKeyFactory diagramCollaborationResourceKeyFactory;

    /**
     * 다이어그램 협업 ticket을 발급한다.
     *
     * @param loginId 로그인 ID
     * @param diagramId 다이어그램 ID
     * @return ticket 발급 결과
     */
    public CollaborationTicketIssueResult execute(String loginId, Long diagramId) {
        return issueCollaborationTicketUseCase.issueVerifiedTicket(
            loginId,
            diagramCollaborationResourceKeyFactory.forDiagramId(diagramId)
        );
    }
}
