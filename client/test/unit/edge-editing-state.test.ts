import assert from 'node:assert/strict';
import test from 'node:test';
import { createKeyedStore } from '../../src/lib/keyed-external-store.js';
import {
  areEdgeEditingStatesEqual,
  buildEdgeEditingStates,
} from '../../src/components/erd/edgeEditingState.js';
import type { LocalEdgeWaypointDrag } from '../../src/stores/erd/useCollaborationStore.js';
import type { EdgeWaypointPreview } from '../../src/types/collaboration.js';

const lock = { clientId: 1, userId: 'u1', name: 'Alice', loginId: 'alice', color: 'red' };
const preview: EdgeWaypointPreview = { edgeId: 'a', waypoints: [{ x: 10, y: 20 }] };
const drag: LocalEdgeWaypointDrag = {
  edgeId: 'b',
  pointerId: 1,
  segmentIndex: 0,
  axis: 'x',
  kind: 'segment',
  routePoints: [],
  initialWaypoints: [],
  previewWaypoints: [{ x: 30, y: 40 }],
};

test('edge subscriptions isolate remote locks and previews from unrelated edges', () => {
  const store = createKeyedStore(
    buildEdgeEditingStates(new Map([['a', lock]]), new Map([['a', preview]]), null),
    areEdgeEditingStatesEqual,
  );
  const calls: string[] = [];
  store.subscribe('a', () => calls.push('a'));
  store.subscribe('b', () => calls.push('b'));
  store.subscribe('idle', () => calls.push('idle'));
  const previous = store.get('a');
  store.update(
    buildEdgeEditingStates(
      new Map([['a', { ...lock }]]),
      new Map([['a', structuredClone(preview)]]),
      null,
    ),
  );
  assert.equal(store.get('a'), previous);
  assert.deepEqual(calls, []);
  store.update(buildEdgeEditingStates(new Map([['a', lock]]), new Map([['a', preview]]), drag));
  assert.equal(store.get('a'), previous);
  assert.deepEqual(calls, ['b']);
  calls.length = 0;
  store.update(
    buildEdgeEditingStates(
      new Map([['a', lock]]),
      new Map([['a', { ...preview, waypoints: [{ x: 11, y: 20 }] }]]),
      drag,
    ),
  );
  assert.deepEqual(calls, ['a']);
  calls.length = 0;
  store.update(
    buildEdgeEditingStates(new Map([['a', { ...lock, color: 'blue' }]]), new Map(), drag),
  );
  assert.deepEqual(calls, ['a']);
  assert.equal(store.get('a')?.edgePreview, null);
});

test('local drag updates, target changes and drag end notify only involved edges', () => {
  const store = createKeyedStore(
    buildEdgeEditingStates(new Map(), new Map(), drag),
    areEdgeEditingStatesEqual,
  );
  const calls: string[] = [];
  for (const id of ['a', 'b', 'idle']) store.subscribe(id, () => calls.push(id));
  const moved = { ...drag, previewWaypoints: [{ x: 50, y: 60 }] };
  store.update(buildEdgeEditingStates(new Map(), new Map(), moved));
  assert.deepEqual(calls, ['b']);
  assert.equal(store.get('b')?.localEdgeDrag, moved);
  calls.length = 0;
  store.update(buildEdgeEditingStates(new Map(), new Map(), { ...moved, edgeId: 'a' }));
  assert.deepEqual(calls, ['b', 'a']);
  assert.equal(store.get('b'), undefined);
  calls.length = 0;
  store.update(buildEdgeEditingStates(new Map(), new Map(), null));
  assert.deepEqual(calls, ['a']);
  assert.equal(store.get('a'), undefined);
});
