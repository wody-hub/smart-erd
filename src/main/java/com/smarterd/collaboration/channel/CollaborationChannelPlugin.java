package com.smarterd.collaboration.channel;

import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;

/**
 * 협업 채널이 제공해야 하는 공통 정책 묶음.
 *
 * <p>다이어그램은 이 인터페이스의 첫 번째 구현체가 되며, 이후 다른 형상이 추가되면
 * 동일한 플러그인 계약으로 협업 코어에 연결한다.</p>
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

    /**
     * 채널 접근 정책을 반환한다.
     *
     * @return 접근 정책
     */
    CollaborationAccessPolicy accessPolicy();

    /**
     * persisted collaboration snapshot 저장소를 반환한다.
     *
     * @return snapshot 저장소
     */
    CollaborationSnapshotStore snapshotStore();

    /**
     * warm handoff 스냅샷 조립 정책을 반환한다.
     *
     * @return handoff 정책
     */
    CollaborationHandoffPolicy handoffPolicy();
}
