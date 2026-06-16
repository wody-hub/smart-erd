package com.smarterd.collaboration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.collaboration.document.DocumentCheckpoint;
import com.smarterd.collaboration.handoff.CollaborationHandoffResult;
import com.smarterd.collaboration.metadata.DocumentMetadata;
import com.smarterd.collaboration.persistence.PersistedDocument;
import com.smarterd.collaboration.plugin.ScopeLockMode;
import com.smarterd.collaboration.snapshot.CollaborationSnapshotSaveCommand;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CollaborationValueObjectsTest {

    @Test
    void snapshotSaveCommandDefensivelyCopiesFullStateUpdate() {
        final var fullStateUpdate = new byte[] { 0x01, 0x02 };
        final var command = new CollaborationSnapshotSaveCommand("17", fullStateUpdate, false);

        fullStateUpdate[0] = 0x09;
        final var exported = command.fullStateUpdate();
        exported[1] = 0x09;

        assertThat(command.fullStateUpdate()).containsExactly(0x01, 0x02);
    }

    @Test
    void handoffResultDefensivelyCopiesSnapshot() {
        final var snapshot = new byte[] { 0x03, 0x04 };
        final var result = new CollaborationHandoffResult(snapshot, "cached");

        snapshot[0] = 0x09;
        final var exported = result.snapshot();
        exported[1] = 0x09;

        assertThat(result.snapshot()).containsExactly(0x03, 0x04);
    }

    @Test
    void documentCheckpointUsesContentBasedArrayEquality() {
        final var left = new DocumentCheckpoint(
            1L,
            "erd",
            "yjs",
            1,
            1,
            1,
            7L,
            new byte[] { 0x01 },
            new byte[] { 0x02 }
        );
        final var right = new DocumentCheckpoint(
            1L,
            "erd",
            "yjs",
            1,
            1,
            1,
            7L,
            new byte[] { 0x01 },
            new byte[] { 0x02 }
        );

        assertThat(left).isEqualTo(right);
        assertThat(left).hasSameHashCodeAs(right);
    }

    @Test
    void persistedDocumentUsesContentBasedArrayEquality() {
        final var left = new PersistedDocument(1L, "erd", "yjs", 1, 1, 1, 7L, new byte[] { 0x01 }, new byte[] { 0x02 });
        final var right = new PersistedDocument(
            1L,
            "erd",
            "yjs",
            1,
            1,
            1,
            7L,
            new byte[] { 0x01 },
            new byte[] { 0x02 }
        );

        assertThat(left).isEqualTo(right);
        assertThat(left).hasSameHashCodeAs(right);
    }

    @Test
    void documentMetadataDefensivelyCopiesMemberIds() {
        final var memberIds = new LinkedHashSet<>(Set.of("member-1"));
        final var metadata = new DocumentMetadata(1L, "erd", "yjs", "owner-1", memberIds);

        memberIds.add("member-2");

        assertThat(metadata.memberIds()).containsExactly("member-1");
        assertThatThrownBy(() -> metadata.memberIds().add("member-3")).isInstanceOf(
            UnsupportedOperationException.class
        );
    }

    @Test
    void scopeLockModeNormalizesExternalWireValue() {
        assertThat(ScopeLockMode.fromWireValue(" SHARED ")).isEqualTo(ScopeLockMode.SHARED);
        assertThat(ScopeLockMode.fromWireValue("Exclusive")).isEqualTo(ScopeLockMode.EXCLUSIVE);
    }
}
