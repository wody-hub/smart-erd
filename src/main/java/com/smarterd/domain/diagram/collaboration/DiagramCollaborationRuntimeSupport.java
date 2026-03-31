package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationAccessPolicy;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupport;
import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널의 runtime 정책 묶음.
 */
@Component
public class DiagramCollaborationRuntimeSupport implements CollaborationRuntimeSupport {

    private final CollaborationAccessPolicy accessPolicy;
    private final CollaborationSnapshotStore snapshotStore;
    private final CollaborationHandoffPolicy handoffPolicy;

    /**
     * 기본 생성자.
     *
     * @param accessPolicy 다이어그램 채널 세션 메타데이터 정책
     * @param snapshotStore 다이어그램 snapshot 저장소
     * @param handoffPolicy 다이어그램 handoff 정책
     */
    public DiagramCollaborationRuntimeSupport(
        DiagramCollaborationSessionMetadataPolicy accessPolicy,
        DiagramCollaborationSnapshotStore snapshotStore,
        DiagramCollaborationHandoffPolicy handoffPolicy
    ) {
        this.accessPolicy = accessPolicy;
        this.snapshotStore = snapshotStore;
        this.handoffPolicy = handoffPolicy;
    }

    @Override
    public String channelType() {
        return DiagramCollaborationResourceKeyFactory.CHANNEL_TYPE;
    }

    @Override
    public CollaborationAccessPolicy accessPolicy() {
        return accessPolicy;
    }

    @Override
    public CollaborationSnapshotStore snapshotStore() {
        return snapshotStore;
    }

    @Override
    public CollaborationHandoffPolicy handoffPolicy() {
        return handoffPolicy;
    }
}
