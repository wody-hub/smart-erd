package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널의 persisted snapshot 저장소 구현.
 */
@Component
public class DiagramCollaborationSnapshotStore implements CollaborationSnapshotStore {

    private final DiagramSnapshotService snapshotService;
    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * 기본 생성자.
     *
     * @param snapshotService 다이어그램 스냅샷 서비스
     * @param resourceKeyFactory 다이어그램 resource key factory
     */
    public DiagramCollaborationSnapshotStore(
        DiagramSnapshotService snapshotService,
        DiagramCollaborationResourceKeyFactory resourceKeyFactory
    ) {
        this.snapshotService = Objects.requireNonNull(snapshotService);
        this.resourceKeyFactory = Objects.requireNonNull(resourceKeyFactory);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public byte[] load(CollaborationResourceKey resourceKey) {
        return snapshotService.loadSnapshot(resourceKeyFactory.parseDiagramId(resourceKey));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public boolean save(CollaborationResourceKey resourceKey, CollaborationSnapshotSaveCommand command) {
        return snapshotService.replaceSnapshotWithClientState(
            resourceKeyFactory.parseDiagramId(resourceKey),
            command.expectedContentRevision(),
            command.fullStateUpdate()
        );
    }
}
