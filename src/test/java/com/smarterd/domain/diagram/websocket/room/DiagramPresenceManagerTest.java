package com.smarterd.domain.diagram.websocket.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@link DiagramPresenceManager} 단위 테스트.
 */
class DiagramPresenceManagerTest {

    @Test
    @DisplayName("onJoin - room lock 없이 호출하면 예외가 발생한다")
    void onJoin_withoutRoomLock_throwsException() {
        // given
        final var manager = new DiagramPresenceManager();
        final var roomLock = new Object();

        // when & then
        assertThatThrownBy(() -> manager.onJoin(roomLock, 1L, "user-1", "User 1"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("room lock");
    }

    @Test
    @DisplayName("onJoin/getPresenceSnapshot - room lock 보유 시 정상 동작한다")
    void onJoin_withRoomLock_returnsSnapshot() {
        // given
        final var manager = new DiagramPresenceManager();
        final var roomLock = new Object();

        // when
        synchronized (roomLock) {
            final var joinResult = manager.onJoin(roomLock, 1L, "user-1", "User 1");

            // then
            assertThat(joinResult.snapshot()).isNotNull();
            assertThat(joinResult.snapshot().participants()).hasSize(1);
            assertThat(joinResult.joinedParticipant()).isNotNull();

            final var snapshot = manager.getPresenceSnapshot(roomLock, 1L);
            assertThat(snapshot).isNotNull();
            assertThat(snapshot.participants()).hasSize(1);
        }
    }
}
