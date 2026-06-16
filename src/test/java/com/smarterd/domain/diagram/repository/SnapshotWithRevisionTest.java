package com.smarterd.domain.diagram.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SnapshotWithRevisionTest {

    @Test
    void snapshotWithRevision_defensivelyCopiesSnapshotBytes() {
        // given
        final var source = new byte[] { 1, 2, 3 };
        final var snapshot = new SnapshotWithRevision(source, 7L);

        // when
        source[0] = 9;
        final var exposed = snapshot.ydocSnapshot();
        exposed[1] = 8;

        // then
        assertThat(snapshot.ydocSnapshot()).containsExactly(1, 2, 3);
    }

    @Test
    void snapshotWithRevision_usesSnapshotContentForEquality() {
        // given
        final var left = new SnapshotWithRevision(new byte[] { 1, 2, 3 }, 7L);
        final var right = new SnapshotWithRevision(new byte[] { 1, 2, 3 }, 7L);

        // then
        assertThat(left).isEqualTo(right);
        assertThat(left).hasSameHashCodeAs(right);
    }
}
