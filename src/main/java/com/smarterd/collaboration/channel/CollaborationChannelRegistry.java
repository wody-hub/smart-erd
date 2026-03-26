package com.smarterd.collaboration.channel;

/**
 * 채널 타입으로 협업 채널 정의를 조회하는 레지스트리 포트.
 */
public interface CollaborationChannelRegistry {
    /**
     * 채널 타입에 해당하는 협업 플러그인을 반환한다.
     *
     * @param channelType 채널 타입
     * @return 협업 플러그인
     */
    CollaborationChannelPlugin getRequired(String channelType);

    /**
     * 협업 리소스 key가 가리키는 채널 플러그인을 반환한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return 협업 플러그인
     */
    default CollaborationChannelPlugin getRequired(CollaborationResourceKey resourceKey) {
        return getRequired(resourceKey.channelType());
    }
}
