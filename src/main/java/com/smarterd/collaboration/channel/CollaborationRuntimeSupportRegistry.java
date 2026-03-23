package com.smarterd.collaboration.channel;

/**
 * 채널 타입으로 런타임 support를 조회하는 레지스트리 포트.
 */
public interface CollaborationRuntimeSupportRegistry {

    /**
     * 채널 타입에 해당하는 런타임 support를 반환한다.
     *
     * @param channelType 채널 타입
     * @return 런타임 support
     */
    CollaborationRuntimeSupport getRequired(String channelType);

    /**
     * 협업 리소스 key가 가리키는 런타임 support를 반환한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return 런타임 support
     */
    default CollaborationRuntimeSupport getRequired(CollaborationResourceKey resourceKey) {
        return getRequired(resourceKey.channelType());
    }
}
