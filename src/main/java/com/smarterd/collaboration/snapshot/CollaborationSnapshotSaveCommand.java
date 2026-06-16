package com.smarterd.collaboration.snapshot;

import java.util.Arrays;
import java.util.Objects;
import org.springframework.lang.NonNull;

/**
 * persisted collaboration snapshot 저장 요청을 표현하는 커맨드.
 *
 * @param expectedContentRevision 저장 시 기대하는 authoritative content revision
 * @param fullStateUpdate         클라이언트가 보낸 전체 Yjs 상태 update
 * @param persistOnlyIfMissing    true면 기존 persisted snapshot이 없을 때만 저장한다.
 */
public record CollaborationSnapshotSaveCommand(
    String expectedContentRevision,
    @NonNull byte[] fullStateUpdate,
    boolean persistOnlyIfMissing
) {
    /**
     * 기본 생성자.
     *
     * <p>전체 상태 update는 방어 복사해 저장 요청의 불변성을 유지한다.</p>
     */
    public CollaborationSnapshotSaveCommand {
        fullStateUpdate = Objects.requireNonNull(fullStateUpdate, "fullStateUpdate must not be null").clone();
    }

    /**
     * 클라이언트 전체 상태 update를 방어 복사해 반환한다.
     *
     * @return full state update
     */
    @Override
    public byte[] fullStateUpdate() {
        return fullStateUpdate.clone();
    }

    /**
     * 배열 필드를 내용 기준으로 비교한다.
     *
     * @param value 비교 대상
     * @return 값 동등 여부
     */
    @Override
    public boolean equals(Object value) {
        if (this == value) {
            return true;
        }
        if (!(value instanceof CollaborationSnapshotSaveCommand other)) {
            return false;
        }
        return (
            persistOnlyIfMissing == other.persistOnlyIfMissing &&
            Objects.equals(expectedContentRevision, other.expectedContentRevision) &&
            Arrays.equals(fullStateUpdate, other.fullStateUpdate)
        );
    }

    /**
     * 배열 필드를 내용 기준으로 해시한다.
     *
     * @return hash code
     */
    @Override
    public int hashCode() {
        var result = Objects.hash(expectedContentRevision, persistOnlyIfMissing);
        result = 31 * result + Arrays.hashCode(fullStateUpdate);
        return result;
    }
}
