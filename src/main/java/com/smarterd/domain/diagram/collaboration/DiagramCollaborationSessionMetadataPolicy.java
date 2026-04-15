package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationAccessPolicy;
import com.smarterd.collaboration.session.CollaborationAuthenticatedSession;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
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
    public DiagramCollaborationSessionMetadataPolicy(DiagramCollaborationResourceKeyFactory resourceKeyFactory) {
        this.resourceKeyFactory = resourceKeyFactory;
    }

    /**
     * {@inheritDoc}
     *
     * @param session 검증할 협업 인증 세션
     */
    @Override
    public void validateAccess(CollaborationAuthenticatedSession session) {
        if (!resourceKeyFactory.channelType().equals(session.resourceKey().channelType())) {
            throw new DomainAccessDeniedException(
                MessageCode.ERROR_ACCESS_DENIED_DIAGRAM_CHANNEL_TYPE.code(),
                session.resourceKey().channelType()
            );
        }

        try {
            resourceKeyFactory.parseDiagramId(session.resourceKey());
        } catch (NumberFormatException e) {
            throw new DomainAccessDeniedException(
                MessageCode.ERROR_ACCESS_DENIED_DIAGRAM_RESOURCE_ID.code(),
                session.resourceKey().resourceId()
            );
        }
    }
}
