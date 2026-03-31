package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationChannelPlugin;
import com.smarterd.collaboration.channel.CollaborationResourceKeyFactory;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널을 협업 플랫폼에 연결하는 첫 번째 plugin 구현.
 *
 * <p>이 구현체는 채널 타입과 resource key 규칙만 소유한다.
 * 런타임 및 ticket 정책은 별도 support 빈으로 분리한다.</p>
 */
@Component
public class DiagramCollaborationChannelPlugin implements CollaborationChannelPlugin {

    /** 다이어그램 협업 채널 타입 */
    public static final String CHANNEL_TYPE = DiagramCollaborationResourceKeyFactory.CHANNEL_TYPE;

    private final CollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * 기본 생성자.
     *
     * @param resourceKeyFactory 다이어그램 채널 resource key factory
     */
    public DiagramCollaborationChannelPlugin(DiagramCollaborationResourceKeyFactory resourceKeyFactory) {
        this.resourceKeyFactory = resourceKeyFactory;
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
}
