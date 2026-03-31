package com.smarterd.collaboration.channel;

import com.smarterd.collaboration.handoff.CollaborationHandoffPolicy;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;

/**
 * 채널 런타임이 필요로 하는 persisted snapshot / handoff / access 정책 묶음.
 */
public interface CollaborationRuntimeSupport {
    /**
     * 지원하는 채널 타입을 반환한다.
     *
     * @return 채널 타입
     */
    String channelType();

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
