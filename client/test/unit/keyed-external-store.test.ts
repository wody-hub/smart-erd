import assert from 'node:assert/strict';
import test from 'node:test';
import { createKeyedStore, shareMapEntries } from '../../src/lib/keyed-external-store.js';
import {
  areRemoteEditLocksEqual,
  areEdgeWaypointPreviewsEqual,
} from '../../src/lib/remote-edit-locks.js';

const equal = (a: { value: number }, b: { value: number }) => a.value === b.value;

test('map sharing preserves equal entries and detects replacements, additions and deletions', () => {
  const a = { value: 1 };
  const b = { value: 2 };
  const previous = new Map([
    ['a', a],
    ['b', b],
  ]);
  assert.equal(
    shareMapEntries(
      previous,
      new Map([
        ['a', { ...a }],
        ['b', { ...b }],
      ]),
      equal,
    ),
    previous,
  );
  const changed = shareMapEntries(
    previous,
    new Map([
      ['a', { ...a }],
      ['b', { value: 3 }],
      ['c', { value: 4 }],
    ]),
    equal,
  );
  assert.equal(changed.get('a'), a);
  assert.notEqual(changed.get('b'), b);
  assert.equal(changed.get('c')?.value, 4);
  const removed = shareMapEntries(changed, new Map([['a', { ...a }]]), equal);
  assert.equal(removed.has('b'), false);
  assert.equal(removed.has('c'), false);
  assert.equal(removed.get('a'), a);
  assert.equal(previous.get('b'), b);
});

test('key subscriptions notify only changed keys and observe the fully published snapshot', () => {
  const store = createKeyedStore(
    new Map([
      ['a', { value: 1 }],
      ['b', { value: 2 }],
    ]),
    equal,
  );
  const calls: string[] = [];
  const stopA = store.subscribe('a', () => {
    calls.push('a');
    assert.equal(store.get('c')?.value, 3);
  });
  store.subscribe('b', () => calls.push('b'));
  store.subscribe('c', () => calls.push('c'));
  const previousB = store.get('b');
  store.update(
    new Map([
      ['a', { value: 10 }],
      ['b', { value: 2 }],
      ['c', { value: 3 }],
    ]),
  );
  assert.deepEqual(calls, ['a', 'c']);
  assert.equal(store.get('b'), previousB);
  calls.length = 0;
  store.update(
    new Map([
      ['a', { value: 10 }],
      ['b', { value: 2 }],
      ['c', { value: 3 }],
    ]),
  );
  assert.deepEqual(calls, []);
  stopA();
  store.update(new Map([['b', { value: 2 }]]));
  assert.deepEqual(calls, ['c']);
  assert.equal(store.get('a'), undefined);
});

test('lock sharing ignores heartbeat recreation but detects every visible owner field', () => {
  const lock = { clientId: 1, userId: 'u1', name: 'Alice', loginId: 'alice', color: 'red' };
  assert.equal(areRemoteEditLocksEqual(lock, { ...lock }), true);
  for (const change of [
    { clientId: 2 },
    { userId: null },
    { name: 'Bob' },
    { loginId: 'bob' },
    { color: 'blue' },
  ]) {
    assert.equal(areRemoteEditLocksEqual(lock, { ...lock, ...change }), false);
  }
});

test('preview sharing compares edge ID, point order, length and coordinates', () => {
  const preview = {
    edgeId: 'e1',
    waypoints: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
  };
  assert.equal(areEdgeWaypointPreviewsEqual(preview, structuredClone(preview)), true);
  for (const changed of [
    { ...preview, edgeId: 'e2' },
    { ...preview, waypoints: [{ x: 1, y: 2 }] },
    {
      ...preview,
      waypoints: [
        { x: 2, y: 2 },
        { x: 3, y: 4 },
      ],
    },
    {
      ...preview,
      waypoints: [
        { x: 1, y: 3 },
        { x: 3, y: 4 },
      ],
    },
    { ...preview, waypoints: [...preview.waypoints].reverse() },
  ])
    assert.equal(areEdgeWaypointPreviewsEqual(preview, changed), false);
});
