package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;

/**
 * 다이어그램 협업 채널의 resource key 생성/파싱 helper.
 */
public final class DiagramCollaborationResourceKeys {

    private static final DiagramCollaborationResourceKeyFactory FACTORY = new DiagramCollaborationResourceKeyFactory();

    private DiagramCollaborationResourceKeys() {}

    /**
     * 다이어그램 ID로 협업 리소스 key를 만든다.
     *
     * @param diagramId 다이어그램 ID
     * @return 협업 리소스 key
     */
    public static CollaborationResourceKey forDiagramId(Long diagramId) {
        return FACTORY.forDiagramId(diagramId);
    }

    /**
     * 협업 리소스 key를 다이어그램 ID로 변환한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return 다이어그램 ID
     */
    public static Long parseDiagramId(CollaborationResourceKey resourceKey) {
        return FACTORY.parseDiagramId(resourceKey);
    }
}
