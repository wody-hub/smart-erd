package com.smarterd.collaboration.channel;

/**
 * 협업 채널의 기본 정의를 나타내는 플러그인 계약.
 *
 * <p>이 인터페이스는 채널 타입과 resource key 규칙만 소유한다.
 * ticket, snapshot, handoff, access 같은 런타임 정책은 별도 support 포트로 분리한다.</p>
 */
public interface CollaborationChannelPlugin {

    /**
     * 채널 타입을 반환한다.
     *
     * @return 채널 타입
     */
    String channelType();

    /**
     * 채널 리소스 key 생성 규칙을 반환한다.
     *
     * @return resource key factory
     */
    CollaborationResourceKeyFactory resourceKeyFactory();

}
