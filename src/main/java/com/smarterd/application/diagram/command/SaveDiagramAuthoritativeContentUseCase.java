package com.smarterd.application.diagram.command;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import com.smarterd.domain.markdown.service.MarkdownDocumentDescriptorService;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * authoritative diagram content 저장과 realtime 상태 정렬을 조율하는 유스케이스.
 */
@Service
@RequiredArgsConstructor
public class SaveDiagramAuthoritativeContentUseCase {

    private final DiagramSnapshotService diagramSnapshotService;
    private final MarkdownDocumentDescriptorService markdownDocumentDescriptorService;

    /**
     * authoritative content 저장을 적용한다.
     *
     * <p>Diagram 엔티티의 authoritative content를 갱신하고, 저장 시점 snapshot이 있으면
     * 같은 revision 기준으로 붙인 뒤 after-commit realtime reconcile을 예약한다.</p>
     *
     * @param diagram       저장 대상 다이어그램
     * @param content       authoritative content JSON
     * @param ydocSnapshot  저장 시점 전체 Y.Doc 상태 update
     */
    public void execute(Diagram diagram, String content, byte[] ydocSnapshot) {
        Objects.requireNonNull(diagram);
        diagram.updateContent(content);
        if (diagram.isMarkdownDocument()) {
            final var descriptor = markdownDocumentDescriptorService.describe(content);
            diagram.updateSummary(descriptor.templateKey(), descriptor.summaryText());
        }
        if (ydocSnapshot != null && ydocSnapshot.length > 0) {
            diagram.updateYdocSnapshot(YjsUpdateFormat.encode(List.of(ydocSnapshot)));
            diagram.syncSnapshotRevision(diagram.getContentRevision());
        }
        diagramSnapshotService.reconcileRealtimeStateWithPersistedContentAfterCommit(diagram.getId(), ydocSnapshot);
    }
}
