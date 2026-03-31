package com.smarterd.application.collaboration.query;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationRuntimeSupportRegistry;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 신규 협업 세션 진입 시 handoff snapshot을 조회하는 유스케이스.
 *
 * <p>1차에서는 다이어그램 채널 하나만 연결하지만, application 계층에서
 * handoff 조회를 orchestration하는 진입점을 먼저 고정한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LoadCollaborationHandoffUseCase {

    private final CollaborationRuntimeSupportRegistry collaborationRuntimeSupportRegistry;

    /**
     * 채널 리소스 기준 협업 handoff snapshot을 로드한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return handoff에 사용할 전체 update snapshot과 출처
     */
    public CollaborationHandoffResult loadHandoffSnapshot(CollaborationResourceKey resourceKey) {
        final var runtimeSupport = collaborationRuntimeSupportRegistry.getRequired(resourceKey);
        return runtimeSupport.handoffPolicy().buildHandoffSnapshot(resourceKey, runtimeSupport.snapshotStore());
    }
}
