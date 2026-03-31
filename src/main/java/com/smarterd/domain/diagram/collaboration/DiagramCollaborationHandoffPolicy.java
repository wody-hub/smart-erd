package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널의 warm handoff 조립 정책.
 *
 * <p>현재 다이어그램 협업이 사용하는 의미를 그대로 보존한다.
 * room pending update가 있으면 warm snapshot을 조립하고,
 * 없으면 persisted snapshot 저장소를 그대로 사용한다.</p>
 */
@Component
public class DiagramCollaborationHandoffPolicy implements CollaborationHandoffPolicy {

    private final DiagramRoomManager roomManager;
    private final DiagramSnapshotService snapshotService;
    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * 기본 생성자.
     *
     * @param roomManager     다이어그램 room 관리자
     * @param snapshotService 다이어그램 스냅샷 서비스
     * @param resourceKeyFactory 다이어그램 resource key factory
     */
    public DiagramCollaborationHandoffPolicy(
        DiagramRoomManager roomManager,
        DiagramSnapshotService snapshotService,
        DiagramCollaborationResourceKeyFactory resourceKeyFactory
    ) {
        this.roomManager = Objects.requireNonNull(roomManager);
        this.snapshotService = Objects.requireNonNull(snapshotService);
        this.resourceKeyFactory = Objects.requireNonNull(resourceKeyFactory);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationHandoffResult buildHandoffSnapshot(
        CollaborationResourceKey resourceKey,
        CollaborationSnapshotStore snapshotStore
    ) {
        final var diagramId = resourceKeyFactory.parseDiagramId(resourceKey);
        final var roomSessionCount = roomManager.getSessionCount(diagramId);
        final var pendingUpdates = roomSessionCount > 1 ? roomManager.peekMergedUpdates(diagramId) : new byte[0];
        if (pendingUpdates.length > 0) {
            return new CollaborationHandoffResult(
                snapshotService.buildWarmHandoffSnapshot(diagramId, pendingUpdates),
                "warm"
            );
        }
        final var cachedSnapshot = snapshotService.getCachedSnapshot(diagramId);
        if (cachedSnapshot.isPresent()) {
            return new CollaborationHandoffResult(cachedSnapshot.get(), "cached");
        }
        return new CollaborationHandoffResult(snapshotStore.load(resourceKey), "db");
    }
}
