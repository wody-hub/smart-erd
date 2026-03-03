import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveRemoteEditLocks } from '../../src/lib/remote-edit-locks.js';
import type { AwarenessState, PresenceParticipant } from '../../src/types/collaboration.js';

function awareness(
  userId: string | null,
  name: string,
  selectedNodeId: string | null,
  editingTableKey?: string | null,
): AwarenessState {
  return {
    user: {
      userId,
      name,
      loginId: `${name.toLowerCase()}@example.com`,
      color: 'hsl(200, 60%, 50%)',
    },
    cursor: null,
    selectedNodeId,
    editingTableKey: editingTableKey ?? null,
  };
}

function participant(userId: string, displayName: string): PresenceParticipant {
  return { userId, displayName, joinSeq: 1 };
}

test('selectedNodeId 가 없는 awareness 는 락으로 계산하지 않는다', () => {
  const cursors = new Map<number, AwarenessState>([
    [1, awareness('u1', 'Alice', null)],
    [2, awareness('u2', 'Bob', 'table-1')],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map());
  assert.equal(locks.size, 1);
  assert.equal(locks.get('table-1')?.userId, 'u2');
});

test('editingTableKey 가 있으면 selectedNodeId 보다 우선한다', () => {
  const state: AwarenessState = {
    ...awareness('u1', 'Alice', 'table-node-1', 'table-lock-1'),
    lockHeartbeatAt: Date.now(),
    editingClientId: 1,
  };
  const cursors = new Map<number, AwarenessState>([[1, state]]);

  const locks = resolveRemoteEditLocks(cursors, new Map());
  assert.equal(locks.size, 1);
  assert.equal(locks.has('table-lock-1'), true);
  assert.equal(locks.has('table-node-1'), false);
});

test('participants 가 존재하면 미참여 userId 락은 무시한다', () => {
  const cursors = new Map<number, AwarenessState>([
    [1, awareness('u-joined', 'Joined', 'table-1')],
    [2, awareness('u-ghost', 'Ghost', 'table-2')],
  ]);
  const participants = new Map<string, PresenceParticipant>([
    ['u-joined', participant('u-joined', 'Joined')],
  ]);

  const locks = resolveRemoteEditLocks(cursors, participants);
  assert.equal(locks.size, 1);
  assert.equal(locks.get('table-1')?.userId, 'u-joined');
  assert.equal(locks.has('table-2'), false);
});

test('participants 가 존재하면 userId=null 락은 무시한다', () => {
  const cursors = new Map<number, AwarenessState>([
    [1, awareness(null, 'Anonymous', 'table-1')],
    [2, awareness('u-joined', 'Joined', 'table-2')],
  ]);
  const participants = new Map<string, PresenceParticipant>([
    ['u-joined', participant('u-joined', 'Joined')],
  ]);

  const locks = resolveRemoteEditLocks(cursors, participants);
  assert.equal(locks.size, 1);
  assert.equal(locks.has('table-1'), false);
  assert.equal(locks.get('table-2')?.userId, 'u-joined');
});

test('lockHeartbeatAt 이 TTL을 넘은 stale 락은 무시한다', () => {
  const stale: AwarenessState = {
    ...awareness('u1', 'Alice', null, 'table-lock-1'),
    lockHeartbeatAt: Date.now() - 8000,
  };
  const fresh: AwarenessState = {
    ...awareness('u2', 'Bob', null, 'table-lock-2'),
    lockHeartbeatAt: Date.now(),
  };
  const cursors = new Map<number, AwarenessState>([
    [1, stale],
    [2, fresh],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map());
  assert.equal(locks.size, 1);
  assert.equal(locks.has('table-lock-1'), false);
  assert.equal(locks.get('table-lock-2')?.userId, 'u2');
});

test('editingTableKey 락은 heartbeat가 없으면 무시한다', () => {
  const missingHeartbeat: AwarenessState = {
    ...awareness('u1', 'Alice', null, 'table-lock-1'),
    lockHeartbeatAt: null,
  };
  const freshFallback: AwarenessState = awareness('u2', 'Bob', 'table-node-2');
  const cursors = new Map<number, AwarenessState>([
    [1, missingHeartbeat],
    [2, freshFallback],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map());
  assert.equal(locks.size, 1);
  assert.equal(locks.has('table-lock-1'), false);
  assert.equal(locks.get('table-node-2')?.userId, 'u2');
});

test('editingClientId 가 실제 clientId 와 다르면 락을 무시한다', () => {
  const spoofedClient: AwarenessState = {
    ...awareness('u1', 'Alice', null, 'table-lock-1'),
    editingClientId: 999,
    lockHeartbeatAt: Date.now(),
  };
  const validClient: AwarenessState = {
    ...awareness('u2', 'Bob', null, 'table-lock-2'),
    editingClientId: 2,
    lockHeartbeatAt: Date.now(),
  };
  const cursors = new Map<number, AwarenessState>([
    [1, spoofedClient],
    [2, validClient],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map());
  assert.equal(locks.size, 1);
  assert.equal(locks.has('table-lock-1'), false);
  assert.equal(locks.get('table-lock-2')?.userId, 'u2');
});

test('동일 테이블 충돌 시 (userId, clientId) 오름차순 후보를 선택한다', () => {
  const cursors = new Map<number, AwarenessState>([
    [20, awareness('u2', 'User2', 'table-1')],
    [10, awareness('u1', 'User1', 'table-1')],
    [1, awareness('u1', 'User1-SecondClient', 'table-1')],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map());
  const winner = locks.get('table-1');

  if (!winner) {
    assert.fail('winner should exist');
  }
  assert.equal(winner.userId, 'u1');
  assert.equal(winner.clientId, 1);
});

test('현재 사용자 userId와 일치하는 락은 원격 락 계산에서 제외한다', () => {
  const cursors = new Map<number, AwarenessState>([
    [1, awareness('self-user', 'Me', 'table-1')],
    [2, awareness('u2', 'User2', 'table-2')],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map(), { selfUserId: 'self-user' });
  assert.equal(locks.has('table-1'), false);
  assert.equal(locks.get('table-2')?.userId, 'u2');
});

test('현재 사용자 loginId와 일치하는 락은 userId가 없어도 제외한다', () => {
  const me = awareness(null, 'Me', 'table-1');
  me.user.loginId = 'me@example.com';
  const other = awareness('u2', 'Other', 'table-2');
  other.user.loginId = 'other@example.com';

  const cursors = new Map<number, AwarenessState>([
    [1, me],
    [2, other],
  ]);

  const locks = resolveRemoteEditLocks(cursors, new Map(), { selfLoginId: 'me@example.com' });
  assert.equal(locks.has('table-1'), false);
  assert.equal(locks.get('table-2')?.userId, 'u2');
});
