package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationAccessPolicy;
import com.smarterd.collaboration.channel.CollaborationChannelPlugin;
import com.smarterd.collaboration.channel.CollaborationResourceKeyFactory;
import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널을 협업 플랫폼에 연결하는 첫 번째 plugin 구현.
 *
 * <p>1차에서는 아직 registry wiring까지 가지 않고, 다이어그램 전용 정책 묶음을
 * 명시적으로 한 클래스에 모아 이후 application/collaboration 계층에서 참조할 수 있게 한다.</p>
 */
@Component
public class DiagramCollaborationChannelPlugin implements CollaborationChannelPlugin {

    /** 다이어그램 협업 채널 타입 */
    public static final String CHANNEL_TYPE = "diagram";

    private final CollaborationResourceKeyFactory resourceKeyFactory;
    private final CollaborationAccessPolicy accessPolicy;
    private final CollaborationSnapshotStore snapshotStore;
    private final CollaborationHandoffPolicy handoffPolicy;

    /**
     * 기본 생성자.
     *
     * @param resourceKeyFactory 다이어그램 채널 resource key factory
     * @param accessPolicy  다이어그램 채널 세션 메타데이터 정책
     * @param snapshotStore 다이어그램 snapshot 저장소
     * @param handoffPolicy 다이어그램 handoff 정책
     */
    public DiagramCollaborationChannelPlugin(
        DiagramCollaborationResourceKeyFactory resourceKeyFactory,
        DiagramCollaborationSessionMetadataPolicy accessPolicy,
        DiagramCollaborationSnapshotStore snapshotStore,
        DiagramCollaborationHandoffPolicy handoffPolicy
    ) {
        this.resourceKeyFactory = resourceKeyFactory;
        this.accessPolicy = accessPolicy;
        this.snapshotStore = snapshotStore;
        this.handoffPolicy = handoffPolicy;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String channelType() {
        return CHANNEL_TYPE;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationResourceKeyFactory resourceKeyFactory() {
        return resourceKeyFactory;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationAccessPolicy accessPolicy() {
        return accessPolicy;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationSnapshotStore snapshotStore() {
        return snapshotStore;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationHandoffPolicy handoffPolicy() {
        return handoffPolicy;
    }
}
