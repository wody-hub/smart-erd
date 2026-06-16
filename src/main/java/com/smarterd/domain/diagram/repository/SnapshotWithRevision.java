package com.smarterd.domain.diagram.repository;

import java.util.Arrays;
import java.util.Objects;
import org.springframework.lang.Nullable;

/**
 * Y.Doc 스냅샷과 리비전 정보를 함께 반환하는 프로젝션 record.
 *
 * @param ydocSnapshot     Y.Doc 바이너리 스냅샷 (null 가능)
 * @param snapshotRevision snapshot 리비전 (null 가능)
 */
public record SnapshotWithRevision(@Nullable byte[] ydocSnapshot, @Nullable Long snapshotRevision) {
    public SnapshotWithRevision {
        ydocSnapshot = copy(ydocSnapshot);
    }

    /**
     * Y.Doc 스냅샷을 방어 복사하여 반환한다.
     *
     * @return Y.Doc 스냅샷 복사본
     */
    @Override
    @Nullable
    public byte[] ydocSnapshot() {
        return copy(ydocSnapshot);
    }

    /**
     * 배열 내용을 포함해 동등성을 비교한다.
     *
     * @param other 비교 대상
     * @return 동등하면 {@code true}
     */
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof SnapshotWithRevision that)) {
            return false;
        }
        return (
            Arrays.equals(ydocSnapshot, that.ydocSnapshot) && Objects.equals(snapshotRevision, that.snapshotRevision)
        );
    }

    /**
     * 배열 내용을 포함한 hash code를 반환한다.
     *
     * @return hash code
     */
    @Override
    public int hashCode() {
        return 31 * Arrays.hashCode(ydocSnapshot) + Objects.hashCode(snapshotRevision);
    }

    /**
     * byte 배열을 방어 복사한다.
     *
     * @param value 원본 배열
     * @return 복사본
     */
    @Nullable
    private static byte[] copy(@Nullable byte[] value) {
        return value == null ? null : Arrays.copyOf(value, value.length);
    }
}
