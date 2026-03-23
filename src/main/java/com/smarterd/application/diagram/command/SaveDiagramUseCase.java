package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramService.SaveDiagramResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 authoritative 저장 유스케이스.
 *
 * <p>접근 검증과 엔티티 조회는 domain 서비스가 담당하고,
 * application 계층은 authoritative 저장 orchestration만 수행한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SaveDiagramUseCase {

    private final DiagramService diagramService;
    private final SaveDiagramAuthoritativeContentUseCase saveDiagramAuthoritativeContentUseCase;

    /**
     * 다이어그램을 저장한다.
     *
     * @param loginId      요청 사용자 로그인 ID
     * @param teamId       팀 ID
     * @param projectId    프로젝트 ID
     * @param diagramId    다이어그램 ID
     * @param content      authoritative content JSON
     * @param ydocSnapshot 저장 시점 전체 Y.Doc 상태
     * @return 저장 결과
     */
    public SaveDiagramResult execute(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        String content,
        byte[] ydocSnapshot
    ) {
        final var diagram = diagramService.loadWritableDiagram(loginId, teamId, projectId, diagramId);
        saveDiagramAuthoritativeContentUseCase.execute(diagram, content, ydocSnapshot);
        return diagramService.buildSaveDiagramResult(diagram);
    }
}
