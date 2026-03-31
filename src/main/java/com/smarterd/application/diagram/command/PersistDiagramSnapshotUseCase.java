package com.smarterd.application.diagram.command;

import com.smarterd.application.collaboration.command.PersistCollaborationSnapshotUseCase;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import com.smarterd.domain.diagram.collaboration.DiagramCollaborationResourceKeyFactory;
import com.smarterd.domain.diagram.service.DiagramService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 협업 snapshot 영속 유스케이스.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class PersistDiagramSnapshotUseCase {

    private final DiagramService diagramService;
    private final DiagramCollaborationResourceKeyFactory diagramCollaborationResourceKeyFactory;
    private final PersistCollaborationSnapshotUseCase persistCollaborationSnapshotUseCase;

    /**
     * 다이어그램 협업 snapshot을 저장한다.
     *
     * @param loginId                 요청 사용자 로그인 ID
     * @param teamId                  팀 ID
     * @param projectId               프로젝트 ID
     * @param diagramId               다이어그램 ID
     * @param expectedContentRevision 저장 기준 content revision
     * @param ydocSnapshot            전체 Y.Doc 상태
     * @param persistOnlyIfMissing    true면 기존 persisted snapshot이 없을 때만 저장
     * @return persisted snapshot 저장 성공 여부
     */
    public boolean execute(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        String expectedContentRevision,
        byte[] ydocSnapshot,
        boolean persistOnlyIfMissing
    ) {
        diagramService.loadWritableDiagram(loginId, teamId, projectId, diagramId);
        return persistCollaborationSnapshotUseCase.persistSnapshot(
            diagramCollaborationResourceKeyFactory.forDiagramId(diagramId),
            new CollaborationSnapshotSaveCommand(expectedContentRevision, ydocSnapshot, persistOnlyIfMissing)
        );
    }
}
