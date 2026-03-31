package com.smarterd.domain.diagram.websocket.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.smarterd.config.websocket.WebSocketProperties;
import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

/**
 * {@link DiagramRoomManager} 단위 테스트.
 */
class DiagramRoomManagerTest {

    private WebSocketProperties webSocketProperties;
    private DiagramRoomManager roomManager;

    @BeforeEach
    void setUp() {
        webSocketProperties = new WebSocketProperties();
        roomManager = new DiagramRoomManager(webSocketProperties);
    }

    @Test
    @DisplayName("drainAndMergeUpdates - 누적 update가 있으면 병합 후 빈 버퍼를 남긴다")
    void drainAndMergeUpdates_withAccumulatedUpdates_returnsMergedAndClearsBuffer() {
        // given
        final var diagramId = 1L;
        final var update1 = new byte[] { 1, 2, 3 };
        final var update2 = new byte[] { 4, 5, 6 };
        roomManager.appendUpdate(diagramId, update1);
        roomManager.appendUpdate(diagramId, update2);

        // when
        final var merged = roomManager.drainAndMergeUpdates(diagramId);

        // then
        assertThat(merged).isNotEmpty();
        // YLPF 디코딩으로 개별 update 복원 검증
        final var decoded = YjsUpdateFormat.decode(merged);
        assertThat(decoded).hasSize(2);
        assertThat(decoded.get(0)).isEqualTo(update1);
        assertThat(decoded.get(1)).isEqualTo(update2);

        // drain 후 다시 호출하면 빈 배열
        final var secondDrain = roomManager.drainAndMergeUpdates(diagramId);
        assertThat(secondDrain).isEmpty();
    }

    @Test
    @DisplayName("drainAndMergeUpdates - 누적 update가 없으면 빈 배열을 반환한다")
    void drainAndMergeUpdates_withNoUpdates_returnsEmptyArray() {
        // given
        final var diagramId = 99L;

        // when
        final var merged = roomManager.drainAndMergeUpdates(diagramId);

        // then
        assertThat(merged).isEmpty();
    }

    @Test
    @DisplayName("restoreUpdates - 복원된 update를 다시 drain할 수 있다")
    void restoreUpdates_afterDrain_canDrainAgain() {
        // given
        final var diagramId = 1L;
        final var update1 = new byte[] { 10, 20 };
        final var update2 = new byte[] { 30, 40 };
        roomManager.appendUpdate(diagramId, update1);
        roomManager.appendUpdate(diagramId, update2);

        // drain으로 추출
        final var drained = roomManager.drainAndMergeUpdates(diagramId);
        assertThat(drained).isNotEmpty();
        assertThat(roomManager.drainAndMergeUpdates(diagramId)).isEmpty();

        // when - 복원
        roomManager.restoreUpdates(diagramId, drained);

        // then - 다시 drain 가능
        final var restored = roomManager.drainAndMergeUpdates(diagramId);
        assertThat(restored).isNotEmpty();
        final var decoded = YjsUpdateFormat.decode(restored);
        assertThat(decoded).hasSize(2);
        assertThat(decoded.get(0)).isEqualTo(update1);
        assertThat(decoded.get(1)).isEqualTo(update2);
    }

    @Test
    @DisplayName("restoreUpdates - null이나 빈 배열이면 아무 동작도 하지 않는다")
    void restoreUpdates_nullOrEmpty_doesNothing() {
        // given
        final var diagramId = 1L;

        // when & then
        roomManager.restoreUpdates(diagramId, null);
        roomManager.restoreUpdates(diagramId, new byte[0]);

        assertThat(roomManager.drainAndMergeUpdates(diagramId)).isEmpty();
    }

    @Test
    @DisplayName("getSessionCount - 세션 입장 수를 정확히 반환한다")
    void getSessionCount_afterJoin_returnsCorrectCount() {
        // given
        final var diagramId = 1L;
        final var session1 = createMockSession("session-1");
        final var session2 = createMockSession("session-2");

        // when
        roomManager.join(diagramId, session1, "user1", "User 1");
        roomManager.join(diagramId, session2, "user2", "User 2");

        // then
        assertThat(roomManager.getSessionCount(diagramId)).isEqualTo(2);
    }

    @Test
    @DisplayName("getSessionCount - 방이 없으면 0을 반환한다")
    void getSessionCount_noRoom_returnsZero() {
        // when & then
        assertThat(roomManager.getSessionCount(999L)).isZero();
    }

    @Test
    @DisplayName("getSessionCount - 퇴장 후 세션 수가 감소한다")
    void getSessionCount_afterLeave_returnsDecrementedCount() {
        // given
        final var diagramId = 1L;
        final var session1 = createMockSession("session-1");
        final var session2 = createMockSession("session-2");
        roomManager.join(diagramId, session1, "user1", "User 1");
        roomManager.join(diagramId, session2, "user2", "User 2");

        // when
        roomManager.leave(diagramId, session1, "user1");

        // then
        assertThat(roomManager.getSessionCount(diagramId)).isEqualTo(1);
    }

    @Test
    @DisplayName("findDiagramIdBySessionId - 입장한 세션의 다이어그램 ID를 O(1)로 조회한다")
    void findDiagramIdBySessionId_afterJoin_returnsDiagramId() {
        // given
        final var diagramId = 77L;
        final var session = createMockSession("session-77");
        roomManager.join(diagramId, session, "user1", "User 1");

        // when
        final var foundDiagramId = roomManager.findDiagramIdBySessionId(session.getId());

        // then
        assertThat(foundDiagramId).isEqualTo(diagramId);
    }

    @Test
    @DisplayName("findDiagramIdBySessionId - 퇴장한 세션의 매핑은 제거된다")
    void findDiagramIdBySessionId_afterLeave_returnsNull() {
        // given
        final var diagramId = 88L;
        final var session = createMockSession("session-88");
        roomManager.join(diagramId, session, "user1", "User 1");
        roomManager.leave(diagramId, session, "user1");

        // when
        final var foundDiagramId = roomManager.findDiagramIdBySessionId(session.getId());

        // then
        assertThat(foundDiagramId).isNull();
    }

    @Test
    @DisplayName("leave - 다른 다이어그램 ID로 잘못 호출되어도 기존 세션 매핑을 유지한다")
    void leave_withWrongDiagramId_keepsSessionMapping() {
        // given
        final var actualDiagramId = 10L;
        final var wrongDiagramId = 20L;
        final var session = createMockSession("session-wrong-diagram");
        roomManager.join(actualDiagramId, session, "user1", "User 1");

        // when
        roomManager.leave(wrongDiagramId, session, "user1");

        // then
        assertThat(roomManager.findDiagramIdBySessionId(session.getId())).isEqualTo(actualDiagramId);
        assertThat(roomManager.getSessionCount(actualDiagramId)).isEqualTo(1);
    }

    @Test
    @DisplayName("leave - 다른 room이 존재해도 잘못된 room 대상 호출은 기존 세션을 제거하지 않는다")
    void leave_withOtherRoomExisting_doesNotRemoveFromActualRoom() {
        // given
        final var roomA = 100L;
        final var roomB = 200L;
        final var sessionA = createMockSession("session-a");
        final var sessionB = createMockSession("session-b");
        roomManager.join(roomA, sessionA, "userA", "User A");
        roomManager.join(roomB, sessionB, "userB", "User B");

        // when
        roomManager.leave(roomA, sessionB, "userB");

        // then
        assertThat(roomManager.findDiagramIdBySessionId(sessionB.getId())).isEqualTo(roomB);
        assertThat(roomManager.getSessionCount(roomB)).isEqualTo(1);
    }

    /**
     * 테스트용 Mock WebSocketSession을 생성한다.
     *
     * @param sessionId 세션 ID
     * @return Mock WebSocketSession
     */
    private WebSocketSession createMockSession(String sessionId) {
        final var session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        return session;
    }
}
