import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { DiagramPreviewHydrationController } from '../../src/collaboration/channel/diagram/diagram-preview-hydration-controller.js';
import { DiagramYjsDocumentAdapter } from '../../src/collaboration/yjs/diagram-yjs-document-adapter.js';
import { getTablesMap } from '../../src/collaboration/yjsBridge.js';
import { transitionCollaborationRuntimeState } from '../../src/collaboration/core/collaboration-session-machine.js';
import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from '../../src/collaboration/core/collaboration-runtime-types.js';

/**
 * 실제 Y.Doc과 가짜 타이머로 preview hydration의 외부 효과를 관찰한다.
 */
function createHarness(context: TestContext) {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  context.mock.method(performance, 'now', () => Date.now());
  const timerFired = context.mock.fn();
  const scheduleTimeout = globalThis.setTimeout;
  context.mock.method(globalThis, 'setTimeout', (callback: () => void, delay?: number) =>
    scheduleTimeout(() => {
      timerFired();
      callback();
    }, delay),
  );
  const info = context.mock.method(console, 'info', () => {});
  const warn = context.mock.method(console, 'warn', () => {});
  const applyBootstrap = context.mock.method(
    DiagramYjsDocumentAdapter.prototype,
    'applyBootstrapToDoc',
  );
  const ydoc = new Y.Doc();
  const remoteDoc = new Y.Doc();
  const tablesMap = getTablesMap(ydoc);
  const unobserve = context.mock.method(tablesMap, 'unobserveDeep');
  const updates = context.mock.fn();
  ydoc.on('update', updates);
  const events: CollaborationRuntimeEvent[] = [];
  const previewModes: boolean[] = [];
  let state: CollaborationRuntimeState = 'preview';
  const controller = new DiagramPreviewHydrationController({
    ydoc,
    bootstrap: {
      hasYdocSnapshot: true,
      contentRevision: '1',
      content: JSON.stringify({
        nodes: [{ id: 'table-1', position: { x: 0, y: 0 }, data: { label: 'seed', columns: [] } }],
        edges: [],
      }),
    },
    previewEnabled: true,
    fallbackTimeoutMs: 5_000,
    handoffStartedAt: 0,
    handoffLogPrefix: '[test]',
    dispatchRuntimeEvent: (event) => {
      events.push(event);
      state = transitionCollaborationRuntimeState(state, event);
    },
    updatePreviewMode: (next) => previewModes.push(next),
    loadPreview: context.mock.fn(),
    getConnectionStatus: () => 'connected',
  });
  context.after(() => {
    controller.dispose();
    ydoc.destroy();
    remoteDoc.destroy();
  });
  const applyRemoteSnapshot = () => {
    getTablesMap(remoteDoc).set('table-1', new Y.Map([['label', 'remote']]));
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remoteDoc), 'remote');
  };
  controller.start();
  return {
    controller,
    ydoc,
    tablesMap,
    updates,
    applyBootstrap,
    applyRemoteSnapshot,
    events,
    previewModes,
    info,
    warn,
    unobserve,
    timerFired,
    getState: () => state,
  };
}

for (const { name, connected, waitMs } of [
  { name: 'connected grace', connected: true, waitMs: 1_000 },
  { name: 'total timeout', connected: false, waitMs: 5_000 },
]) {
  test(`${name} keeps empty live doc untouched and degrades only once`, (context) => {
    const h = createHarness(context);
    const initialState = Y.encodeStateAsUpdate(h.ydoc);
    if (connected) h.controller.onConnected(0);

    context.mock.timers.tick(waitMs);

    assert.equal(h.applyBootstrap.mock.callCount(), 0);
    assert.deepEqual(Y.encodeStateAsUpdate(h.ydoc), initialState);
    assert.equal(h.tablesMap.size, 0);
    assert.equal(h.updates.mock.callCount(), 0);
    assert.equal(h.timerFired.mock.callCount(), 1);
    assert.deepEqual(h.previewModes, [true]);
    assert.deepEqual(h.events, ['bootstrap-loaded', 'fallback-timeout']);
    assert.equal(h.getState(), 'degraded');
    assert.equal(h.warn.mock.callCount(), 1);
    assert.equal(h.unobserve.mock.callCount(), 0);

    h.controller.onConnected(waitMs);
    context.mock.timers.tick(10_000);
    assert.deepEqual(h.events, ['bootstrap-loaded', 'fallback-timeout']);
    assert.equal(h.warn.mock.callCount(), 1);
    assert.equal(h.applyBootstrap.mock.callCount(), 0);
    assert.equal(h.updates.mock.callCount(), 0);
    assert.equal(h.timerFired.mock.callCount(), 1);
  });

  test(`remote snapshot after ${name} still unlocks degraded preview`, (context) => {
    const h = createHarness(context);
    if (connected) h.controller.onConnected(0);
    context.mock.timers.tick(waitMs);

    h.applyRemoteSnapshot();

    assert.deepEqual(h.events, ['bootstrap-loaded', 'fallback-timeout', 'remote-snapshot-applied']);
    assert.deepEqual(h.previewModes, [true, false]);
    assert.equal(h.tablesMap.get('table-1')?.get('label'), 'remote');
    assert.equal(h.getState(), 'live');
    assert.equal(h.info.mock.calls[h.info.mock.calls.length - 1]?.arguments[2], 'remote');
    assert.equal(h.unobserve.mock.callCount(), 1);
    context.mock.timers.tick(10_000);
    assert.equal(h.events.length, 3);
    assert.equal(h.warn.mock.callCount(), 1);
    assert.equal(h.applyBootstrap.mock.callCount(), 0);
    assert.equal(h.timerFired.mock.callCount(), 1);
  });
}

test('remote snapshot before timeout unlocks preview and cancels both timers', (context) => {
  const h = createHarness(context);
  h.controller.onConnected(0);
  context.mock.timers.tick(500);

  h.applyRemoteSnapshot();

  assert.deepEqual(h.events, ['bootstrap-loaded', 'remote-snapshot-applied']);
  assert.deepEqual(h.previewModes, [true, false]);
  assert.equal(h.info.mock.calls[h.info.mock.calls.length - 1]?.arguments[2], 'remote');
  assert.equal(h.unobserve.mock.callCount(), 1);
  context.mock.timers.tick(10_000);
  assert.deepEqual(h.events, ['bootstrap-loaded', 'remote-snapshot-applied']);
  assert.equal(h.warn.mock.callCount(), 0);
  assert.equal(h.applyBootstrap.mock.callCount(), 0);
  assert.equal(h.timerFired.mock.callCount(), 0);
});

for (const degraded of [false, true]) {
  test(`dispose clears timers and observer (${degraded ? 'degraded' : 'waiting'})`, (context) => {
    const h = createHarness(context);
    h.controller.onConnected(0);
    if (degraded) context.mock.timers.tick(1_000);
    h.controller.dispose();
    const events = [...h.events];
    const warningCount = h.warn.mock.callCount();

    context.mock.timers.tick(10_000);
    h.applyRemoteSnapshot();

    assert.deepEqual(h.events, events);
    assert.deepEqual(h.previewModes, [true, false]);
    assert.equal(h.unobserve.mock.callCount(), 1);
    assert.equal(h.warn.mock.callCount(), warningCount);
    assert.equal(h.applyBootstrap.mock.callCount(), 0);
    assert.equal(h.timerFired.mock.callCount(), degraded ? 1 : 0);
  });
}
