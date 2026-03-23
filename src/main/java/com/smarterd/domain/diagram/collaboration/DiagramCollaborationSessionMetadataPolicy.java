package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationAccessPolicy;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import org.springframework.stereotype.Component;

/**
 * 다이어그램 채널 세션 메타데이터 검증 정책.
 *
 * <p>1차에서는 WebSocket ticket 검증이 실질적인 접근 제어를 담당하므로,
 * 이 정책은 diagram 채널 세션 메타데이터 형태를 재검증하는 역할까지만 맡는다.</p>
 */
@Component
public class DiagramCollaborationSessionMetadataPolicy implements CollaborationAccessPolicy {

    private final DiagramCollaborationResourceKeyFactory resourceKeyFactory;

    /**
     * 기본 생성자.
     *
     * @param resourceKeyFactory 다이어그램 resource key factory
     */
    public DiagramCollaborationSessionMetadataPolicy(
        DiagramCollaborationResourceKeyFactory resourceKeyFactory
    ) {
        this.resourceKeyFactory = resourceKeyFactory;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void validateAccess(CollaborationAuthenticatedSession session) {
        if (!resourceKeyFactory.channelType().equals(session.resourceKey().channelType())) {
            throw new IllegalArgumentException(
                "다이어그램 채널 접근 정책에 맞지 않는 채널 타입: " + session.resourceKey().channelType()
            );
        }

        try {
            resourceKeyFactory.parseDiagramId(session.resourceKey());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                "다이어그램 채널 resourceId는 Long으로 해석 가능해야 한다: " + session.resourceKey().resourceId(),
                e
            );
        }
    }
}
