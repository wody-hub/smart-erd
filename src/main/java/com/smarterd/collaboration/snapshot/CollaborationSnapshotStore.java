package com.smarterd.collaboration.snapshot;

import com.smarterd.collaboration.channel.CollaborationResourceKey;

/**
 * persisted collaboration snapshot 저장소 포트.
 *
 * <p>이 포트는 persisted snapshot load/save만 담당한다.
 * warm handoff 조합은 별도 {@code CollaborationHandoffPolicy}가 담당해야 한다.</p>
 */
public interface CollaborationSnapshotStore {

    /**
     * persisted collaboration snapshot을 로드한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return persisted snapshot 전체 update, 없으면 빈 배열 또는 null은 구현체 정책에 따른다
     */
    byte[] load(CollaborationResourceKey resourceKey);

    /**
     * 클라이언트 상태를 persisted snapshot으로 저장한다.
     *
     * @param resourceKey 협업 리소스 key
     * @param command     snapshot 저장 커맨드
     * @return 저장 성공 여부
     */
    boolean save(CollaborationResourceKey resourceKey, CollaborationSnapshotSaveCommand command);
}
