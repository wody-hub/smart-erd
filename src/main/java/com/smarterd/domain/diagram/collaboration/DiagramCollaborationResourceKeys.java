package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;

/**
 * 다이어그램 협업 채널의 resource key 생성/파싱 helper.
 */
public final class DiagramCollaborationResourceKeys {

    private DiagramCollaborationResourceKeys() {}

    /**
     * 다이어그램 ID로 협업 리소스 key를 만든다.
     *
     * @param diagramId 다이어그램 ID
     * @return 협업 리소스 key
     */
    public static CollaborationResourceKey forDiagramId(Long diagramId) {
        return new CollaborationResourceKey(
            DiagramCollaborationChannelPlugin.CHANNEL_TYPE,
            String.valueOf(diagramId)
        );
    }

    /**
     * 협업 리소스 key를 다이어그램 ID로 변환한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return 다이어그램 ID
     */
    public static Long parseDiagramId(CollaborationResourceKey resourceKey) {
        if (!DiagramCollaborationChannelPlugin.CHANNEL_TYPE.equals(resourceKey.channelType())) {
            throw new IllegalArgumentException(
                "다이어그램 채널에 맞지 않는 채널 타입: " + resourceKey.channelType()
            );
        }
        return Long.parseLong(resourceKey.resourceId());
    }
}
