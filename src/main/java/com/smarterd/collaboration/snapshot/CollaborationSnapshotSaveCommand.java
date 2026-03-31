package com.smarterd.collaboration.snapshot;

/**
 * persisted collaboration snapshot 저장 요청을 표현하는 커맨드.
 *
 * @param expectedContentRevision 저장 시 기대하는 authoritative content revision
 * @param fullStateUpdate         클라이언트가 보낸 전체 Yjs 상태 update
 * @param persistOnlyIfMissing    true면 기존 persisted snapshot이 없을 때만 저장한다.
 */
public record CollaborationSnapshotSaveCommand(
    String expectedContentRevision,
    byte[] fullStateUpdate,
    boolean persistOnlyIfMissing
) {}
