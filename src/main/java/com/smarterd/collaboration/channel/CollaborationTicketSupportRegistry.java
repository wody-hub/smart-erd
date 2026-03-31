package com.smarterd.collaboration.channel;

/**
 * 채널 타입으로 ticket support를 조회하는 레지스트리 포트.
 */
public interface CollaborationTicketSupportRegistry {
    /**
     * 채널 타입에 해당하는 ticket support를 반환한다.
     *
     * @param channelType 채널 타입
     * @return ticket support
     */
    CollaborationTicketSupport getRequired(String channelType);

    /**
     * 협업 리소스 key가 가리키는 ticket support를 반환한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return ticket support
     */
    default CollaborationTicketSupport getRequired(CollaborationResourceKey resourceKey) {
        return getRequired(resourceKey.channelType());
    }
}
