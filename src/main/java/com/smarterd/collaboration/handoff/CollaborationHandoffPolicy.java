package com.smarterd.collaboration.handoff;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotStore;

/**
 * 신규 세션 진입 시 handoff snapshot을 조립하는 정책 포트.
 *
 * <p>현재 다이어그램 협업의 핵심은 단순 persisted snapshot 로드가 아니라
 * warm room state, cached snapshot, persisted snapshot을 우선순위에 따라 조합하는 것이다.
 * 이 정책은 그 의미를 공통 계약으로 고정하기 위한 seam이다.</p>
 */
public interface CollaborationHandoffPolicy {

    /**
     * 현재 채널 리소스 기준 handoff snapshot을 조립한다.
     *
     * @param resourceKey   협업 리소스 key
     * @param snapshotStore persisted snapshot 저장소
     * @return handoff에 사용할 전체 update와 출처
     */
    CollaborationHandoffResult buildHandoffSnapshot(
        CollaborationResourceKey resourceKey,
        CollaborationSnapshotStore snapshotStore
    );
}
