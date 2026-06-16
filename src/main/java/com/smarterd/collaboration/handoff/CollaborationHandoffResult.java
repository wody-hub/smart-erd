package com.smarterd.collaboration.handoff;

import java.util.Arrays;
import java.util.Objects;
import org.springframework.lang.NonNull;

/**
 * 협업 handoff 스냅샷과 그 출처를 함께 표현하는 결과 모델.
 *
 * @param snapshot handoff에 사용할 전체 update 스냅샷
 * @param source   handoff 출처 (`warm`, `cached`, `db`)
 */
public record CollaborationHandoffResult(@NonNull byte[] snapshot, String source) {
    /**
     * 기본 생성자.
     *
     * <p>handoff snapshot은 방어 복사해 결과 모델의 불변성을 유지한다.</p>
     */
    public CollaborationHandoffResult {
        snapshot = Objects.requireNonNull(snapshot, "snapshot must not be null").clone();
    }

    /**
     * handoff snapshot을 방어 복사해 반환한다.
     *
     * @return handoff snapshot
     */
    @Override
    public byte[] snapshot() {
        return snapshot.clone();
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
        if (!(value instanceof CollaborationHandoffResult other)) {
            return false;
        }
        return Objects.equals(source, other.source) && Arrays.equals(snapshot, other.snapshot);
    }

    /**
     * 배열 필드를 내용 기준으로 해시한다.
     *
     * @return hash code
     */
    @Override
    public int hashCode() {
        var result = Objects.hash(source);
        result = 31 * result + Arrays.hashCode(snapshot);
        return result;
    }
}
