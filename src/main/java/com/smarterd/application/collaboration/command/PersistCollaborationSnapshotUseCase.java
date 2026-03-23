package com.smarterd.application.collaboration.command;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationChannelRegistry;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 클라이언트가 보낸 현재 협업 snapshot을 persisted 상태로 저장하는 유스케이스.
 */
@Service
@RequiredArgsConstructor
public class PersistCollaborationSnapshotUseCase {

    private final CollaborationChannelRegistry collaborationChannelRegistry;

    /**
     * 채널 리소스 기준 협업 snapshot을 저장한다.
     *
     * @param resourceKey 협업 리소스 key
     * @param command     snapshot 저장 커맨드
     * @return 저장 성공 여부
     */
    public boolean persistSnapshot(
        CollaborationResourceKey resourceKey,
        CollaborationSnapshotSaveCommand command
    ) {
        final var channelPlugin = collaborationChannelRegistry.getRequired(resourceKey.channelType());
        return channelPlugin.snapshotStore().save(resourceKey, command);
    }
}
