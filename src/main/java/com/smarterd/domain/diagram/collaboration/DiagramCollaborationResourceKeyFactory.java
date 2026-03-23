package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationResourceKeyFactory;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널의 협업 resource key 생성/해석 규칙.
 */
@Component
public class DiagramCollaborationResourceKeyFactory implements CollaborationResourceKeyFactory {

    /**
     * {@inheritDoc}
     */
    @Override
    public String channelType() {
        return DiagramCollaborationChannelPlugin.CHANNEL_TYPE;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationResourceKey create(String resourceId) {
        return new CollaborationResourceKey(channelType(), resourceId);
    }

    /**
     * 다이어그램 ID를 협업 resource key로 만든다.
     *
     * @param diagramId 다이어그램 ID
     * @return 협업 리소스 key
     */
    public CollaborationResourceKey forDiagramId(Long diagramId) {
        return create(String.valueOf(diagramId));
    }

    /**
     * 협업 resource key를 다이어그램 ID로 파싱한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return 다이어그램 ID
     */
    public Long parseDiagramId(CollaborationResourceKey resourceKey) {
        if (!channelType().equals(resourceKey.channelType())) {
            throw new IllegalArgumentException(
                "다이어그램 채널에 맞지 않는 채널 타입: " + resourceKey.channelType()
            );
        }
        return Long.parseLong(resourceKey.resourceId());
    }
}
