import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DiagramCollaborationProviderEvents,
  type DiagramCollaborationStoreBridge,
} from '../../src/collaboration/channel/diagram/diagram-collaboration-testable.js';
import type { CollaborationRuntimeEvent } from '../../src/collaboration/core/collaboration-runtime-types.js';

function createStoreBridge() {
  const calls = {
    connectionStatus: [] as string[],
    presenceMode: [] as string[],
    selfUserId: [] as string[],
    presenceSnapshot: [] as unknown[],
    peerJoined: [] as unknown[],
    peerLeft: [] as unknown[],
    awareness: [] as Array<{ clientId: number; state: unknown }>,
    removedUserIds: [] as string[],
    removedLoginIds: [] as string[],
  };
  const bridge: DiagramCollaborationStoreBridge = {
    loadPreview: () => undefined,
    setConnectionStatus: (status) => {
      calls.connectionStatus.push(status);
    },
    setPresenceMode: (mode) => {
      calls.presenceMode.push(mode);
    },
    setSelfUserId: (userId) => {
      calls.selfUserId.push(userId);
    },
    applyPresenceSnapshot: (payload) => {
      calls.presenceSnapshot.push(payload);
    },
    applyPeerJoined: (payload) => {
      calls.peerJoined.push(payload);
    },
    applyPeerLeft: (payload) => {
      calls.peerLeft.push(payload);
    },
    updateAwareness: (clientId, state) => {
      calls.awareness.push({ clientId, state });
    },
    removePeerByUserId: (userId) => {
      calls.removedUserIds.push(userId);
    },
    removePeerByLoginId: (loginId) => {
      calls.removedLoginIds.push(loginId);
    },
    resetCollaboration: () => undefined,
  };
  return { bridge, calls };
}

function createEvents() {
  const runtimeEvents: CollaborationRuntimeEvent[] = [];
  const { bridge, calls } = createStoreBridge();
  const events = new DiagramCollaborationProviderEvents({
    storeBridge: bridge,
    dispatchRuntimeEvent: (event) => {
      runtimeEvents.push(event);
    },
    handoffLogPrefix: '[test]',
    handoffStartedAt: 0,
  });
  return { events, calls, runtimeEvents };
}

function withSuppressedConsoleInfo<T>(run: () => T): T {
  const originalConsoleInfo = console.info;
  console.info = () => undefined;
  try {
    return run();
  } finally {
    console.info = originalConsoleInfo;
  }
}

test('connected 이후 reconnect-start 와 disconnect/runtime status 를 올린다', () => {
  withSuppressedConsoleInfo(() => {
    const { events, calls, runtimeEvents } = createEvents();
    const connectedAt: number[] = [];
    const callbacks = events.createBindingCallbacks((wsConnectedAt) => {
      connectedAt.push(wsConnectedAt);
    });

    callbacks.onConnectionStatusChange('connected');
    callbacks.onConnectionStatusChange('connecting');
    callbacks.onConnectionStatusChange('disconnected');

    assert.equal(calls.connectionStatus[0], 'connected');
    assert.equal(calls.connectionStatus[1], 'connecting');
    assert.equal(calls.connectionStatus[2], 'disconnected');
    assert.equal(runtimeEvents[0], 'ws-connected');
    assert.equal(runtimeEvents[1], 'reconnect-start');
    assert.equal(runtimeEvents[2], 'disconnect');
    assert.equal(connectedAt.length, 1);
    assert.equal(events.getConnectionStatus(), 'disconnected');
  });
});

test('identity/presence/awareness/peer-left 이벤트를 store bridge에 전달한다', () => {
  const { events, calls } = createEvents();
  const callbacks = events.createBindingCallbacks(() => undefined);

  callbacks.onIdentityResolved('user-1');
  callbacks.onPresenceModeChange('active');
  callbacks.onPresenceSnapshot({
    diagramId: '259',
    roomEpoch: 'epoch-1',
    presenceVersion: 1,
    participants: [],
    totalIncludingSelf: 1,
  });
  callbacks.onPresencePeerJoined({
    diagramId: '259',
    roomEpoch: 'epoch-1',
    presenceVersion: 2,
    participant: {
      userId: 'user-2',
      displayName: 'User 2',
      joinSeq: 2,
    },
  });
  callbacks.onPresencePeerLeft({
    diagramId: '259',
    roomEpoch: 'epoch-1',
    presenceVersion: 3,
    userId: 'user-3',
  });
  callbacks.onAwarenessReceived(11, {
    user: {
      userId: 'user-2',
      name: 'User 2',
      loginId: 'user2@example.com',
      color: 'hsl(0 0% 50%)',
    },
    cursor: null,
    selectedNodeId: null,
    editingTableKey: 'users',
  });
  callbacks.onPeerLeft('legacy@example.com');

  assert.deepEqual(calls.selfUserId, ['user-1']);
  assert.deepEqual(calls.presenceMode, ['active']);
  assert.equal(calls.presenceSnapshot.length, 1);
  assert.equal(calls.peerJoined.length, 1);
  assert.equal(calls.peerLeft.length, 1);
  assert.deepEqual(calls.removedUserIds, ['user-3']);
  assert.deepEqual(calls.awareness, [
    {
      clientId: 11,
      state: {
        user: {
          userId: 'user-2',
          name: 'User 2',
          loginId: 'user2@example.com',
          color: 'hsl(0 0% 50%)',
        },
        cursor: null,
        selectedNodeId: null,
        editingTableKey: 'users',
      },
    },
  ]);
  assert.deepEqual(calls.removedLoginIds, ['legacy@example.com']);
});
