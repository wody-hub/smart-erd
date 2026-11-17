import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createBlockCommitState,
  reduceBlockCommit,
  type BlockCommitState,
} from '../../src/lib/code-block-commit-state.js';

/** 새로운 유효 로컬 편집 상태를 만든다. */
function valid(now = 0): BlockCommitState {
  const dirty = reduceBlockCommit(createBlockCommitState('base'), {
    type: 'edit',
    text: 'local',
    now,
  }).state;
  return reduceBlockCommit(dirty, {
    type: 'parsed',
    version: dirty.version,
    result: 'VALID',
    now: now + 150,
  }).state;
}
test('edit schedules 150/800/5000 timers; stale parse cannot validate newer text', () => {
  const result = reduceBlockCommit(createBlockCommitState('base'), {
    type: 'edit',
    text: 'local',
    now: 10,
  });
  assert.equal(result.state.status, 'DIRTY');
  assert.deepEqual(
    result.effects.filter((effect) => effect.type === 'schedule').map((effect) => effect.delayMs),
    [150, 800, 5000],
  );
  const edited = reduceBlockCommit(result.state, { type: 'edit', text: 'new', now: 20 }).state;
  assert.equal(
    reduceBlockCommit(edited, {
      type: 'parsed',
      version: result.state.version,
      result: 'VALID',
      now: 200,
    }).state.status,
    'DIRTY',
  );
});
test('valid idle commits, ack cleans, additional input during commit stays dirty', () => {
  const committing = reduceBlockCommit(valid(), { type: 'timer', timer: 'idle', now: 800 });
  assert.equal(committing.state.status, 'COMMITTING');
  assert.ok(committing.effects.some((effect) => effect.type === 'commit'));
  assert.equal(
    reduceBlockCommit(committing.state, {
      type: 'commit-success',
      version: committing.state.version,
      now: 810,
    }).state.status,
    'CLEAN',
  );
  const edited = reduceBlockCommit(committing.state, {
    type: 'edit',
    text: 'next',
    now: 805,
  }).state;
  assert.equal(
    reduceBlockCommit(edited, {
      type: 'commit-success',
      version: committing.state.version,
      now: 810,
    }).state.status,
    'DIRTY',
  );
});
test('IME defers leave and commits only after composing ends and fresh parse validates', () => {
  let state = reduceBlockCommit(valid(), { type: 'composition-start', now: 200 }).state;
  state = reduceBlockCommit(state, { type: 'leave', now: 300 }).state;
  assert.equal(
    reduceBlockCommit(state, { type: 'timer', timer: 'max-wait', now: 6000 }).effects.some(
      (e) => e.type === 'commit',
    ),
    false,
  );
  const end = reduceBlockCommit(state, { type: 'composition-end', now: 6100 });
  assert.ok(end.effects.some((e) => e.type === 'parse'));
  const result = reduceBlockCommit(end.state, {
    type: 'parsed',
    version: end.state.version,
    result: 'VALID',
    now: 6101,
  });
  assert.equal(result.state.status, 'COMMITTING');
});
test('minimum interval 500ms also applies to leave; max wait commits despite recent input', () => {
  const state = { ...valid(200), lastCommittedAt: 100 };
  const result = reduceBlockCommit(state, { type: 'leave', now: 400 });
  assert.equal(result.state.status, 'VALID');
  assert.ok(
    result.effects.some(
      (e) => e.type === 'schedule' && e.timer === 'min-interval' && e.delayMs === 200,
    ),
  );
  assert.equal(
    reduceBlockCommit(result.state, { type: 'timer', timer: 'min-interval', now: 600 }).state
      .status,
    'COMMITTING',
  );
  assert.equal(
    reduceBlockCommit(
      { ...valid(), lastInputAt: 4999 },
      { type: 'timer', timer: 'max-wait', now: 5000 },
    ).state.status,
    'COMMITTING',
  );
});
test('invalid/unsupported/conflict/blocked never commit and readiness regain reparses', () => {
  for (const status of ['INVALID', 'UNSUPPORTED', 'CONFLICT'] as const) {
    assert.equal(
      reduceBlockCommit({ ...valid(), status }, { type: 'leave', now: 1000 }).effects.some(
        (e) => e.type === 'commit',
      ),
      false,
    );
  }
  const blocked = reduceBlockCommit(valid(), { type: 'readiness', ready: false, now: 200 });
  assert.equal(blocked.state.status, 'BLOCKED');
  assert.ok(blocked.effects.some((e) => e.type === 'cancel-timers'));
  assert.equal(
    reduceBlockCommit(blocked.state, { type: 'leave', now: 1000 }).effects.some(
      (e) => e.type === 'commit',
    ),
    false,
  );
  assert.equal(
    reduceBlockCommit(blocked.state, { type: 'readiness', ready: true, now: 1100 }).state.status,
    'DIRTY',
  );
});

test('remote deletion remains blocked after edits/readiness and stale pre-reconnect parse is ignored', () => {
  const removed = reduceBlockCommit(valid(), { type: 'entity-removed', now: 200 }).state;
  const edited = reduceBlockCommit(removed, { type: 'edit', text: 'new', now: 300 }).state;
  const ready = reduceBlockCommit(edited, { type: 'readiness', ready: true, now: 400 }).state;
  assert.equal(ready.status, 'BLOCKED');
  assert.equal(
    reduceBlockCommit(ready, { type: 'parsed', version: ready.version, result: 'VALID', now: 500 })
      .state.status,
    'BLOCKED',
  );
  const disconnected = reduceBlockCommit(valid(), {
    type: 'readiness',
    ready: false,
    now: 200,
  }).state;
  const reconnected = reduceBlockCommit(disconnected, {
    type: 'readiness',
    ready: true,
    now: 300,
  }).state;
  assert.equal(
    reduceBlockCommit(reconnected, {
      type: 'parsed',
      version: disconnected.version,
      result: 'VALID',
      now: 400,
    }).state.status,
    'DIRTY',
  );
});

test('max wait requests current parse even while typing; deletion stays blocked through disconnect', () => {
  const dirty = reduceBlockCommit(createBlockCommitState('base'), {
    type: 'edit',
    text: 'local',
    now: 0,
  }).state;
  assert.ok(
    reduceBlockCommit(dirty, { type: 'timer', timer: 'max-wait', now: 5000 }).effects.some(
      (e) => e.type === 'parse',
    ),
  );
  const removed = reduceBlockCommit(valid(), { type: 'entity-removed', now: 200 }).state;
  const disconnected = reduceBlockCommit(removed, {
    type: 'readiness',
    ready: false,
    now: 300,
  }).state;
  const reconnected = reduceBlockCommit(disconnected, {
    type: 'readiness',
    ready: true,
    now: 400,
  }).state;
  assert.equal(reconnected.status, 'BLOCKED');
  assert.equal(reconnected.blockedReason, 'entity-removed');
});
