import assert from 'node:assert/strict';
import test from 'node:test';
import * as Y from 'yjs';
import { DiagramCodeProjectionState } from '../../src/collaboration/channel/diagram/diagram-code-projection-state.js';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import { collectErdAffectedScopes } from '../../src/collaboration/plugins/erd/erd-yjs-update-scope-collector.js';
import { createTableYMap, getTablesMap } from '../../src/collaboration/yjsBridge.js';

const dictionary = { version: 1, fingerprint: 'empty', dictionary: { terms: [], domains: [] } };

/** 실제 읽기 스토어와 수화 게이트를 만든다. */
function harness() {
  const doc = new Y.Doc();
  const engine = new YjsSharedDocumentEngine(doc);
  const tracker = new DocumentRevisionTracker();
  const store = new DocumentStore(
    new ErdDocumentMutationApplier(engine),
    tracker,
    new ErdDocumentReadContextFactory(engine, tracker),
    () => engine.exportSnapshot(),
    (update) => collectErdAffectedScopes(engine, update),
  );
  store.attach();
  const off = engine.subscribeUpdates((update) => tracker.handleDocumentUpdated(update));
  let ready = false;
  let epoch = 0;
  const source = {
    read: store,
    getDocument: () => doc,
    isReady: () => ready,
    getEpoch: () => epoch,
  };
  return {
    doc,
    source,
    tables: getTablesMap(doc),
    ready: (next: boolean) => {
      ready = next;
      epoch++;
    },
    dispose: () => {
      off();
      store.dispose();
      doc.destroy();
    },
  };
}

test('hook state machine waits for authoritative hydration, patches and resyncs after reconnect', async () => {
  const h = harness();
  const state = new DiagramCodeProjectionState();
  state.connect(true, h.source, dictionary);
  h.tables.set('a', createTableYMap('before', { x: 0, y: 0 }, []));
  await Promise.resolve();
  assert.equal(state.getSnapshot().status, 'hydrating');
  assert.equal(state.getSnapshot().text, '');
  h.ready(true);
  state.refreshReadiness();
  assert.equal(state.getSnapshot().status, 'ready');
  assert.match(state.getSnapshot().text, /before/);
  const first = state.getSnapshot().revision;
  h.tables.get('a')!.set('label', 'renamed');
  await Promise.resolve();
  assert.ok(state.getSnapshot().revision > first);
  assert.match(state.getSnapshot().text, /renamed/);
  h.ready(false);
  state.refreshReadiness();
  assert.equal(state.getSnapshot().status, 'resync');
  h.tables.get('a')!.set('label', 'reconnected');
  await Promise.resolve();
  assert.doesNotMatch(state.getSnapshot().text, /reconnected/);
  h.ready(true);
  state.refreshReadiness();
  assert.equal(state.getSnapshot().status, 'ready');
  assert.match(state.getSnapshot().text, /reconnected/);
  state.disconnect();
  h.dispose();
});

test('off never creates a port or subscribes to the document', () => {
  const state = new DiagramCodeProjectionState();
  let subscriptions = 0;
  const h = harness();
  const source = {
    ...h.source,
    read: {
      execute: h.source.read.execute.bind(h.source.read),
      getRevision: () => '0',
      subscribe: () => {
        subscriptions++;
        return () => {};
      },
    },
  };
  state.connect(false, source, dictionary);
  assert.equal(subscriptions, 0);
  assert.equal(state.getSnapshot().status, 'disabled');
  h.dispose();
});

test('document replacement preserves consumer revisions and produces incremental edits', () => {
  const h = harness();
  const replacement = harness();
  h.tables.set('a', createTableYMap('stable', { x: 0, y: 0 }, []));
  replacement.tables.set('a', createTableYMap('stable', { x: 0, y: 0 }, []));
  replacement.tables.set('b', createTableYMap('added', { x: 0, y: 0 }, []));
  h.ready(true);
  replacement.ready(true);
  const state = new DiagramCodeProjectionState();
  state.connect(true, h.source, dictionary);
  const before = state.getSnapshot();
  let edits: { start: number; end: number; text: string }[] = [];
  state.subscribePatches(({ batch }) => {
    edits = batch.patches;
  });
  state.connect(true, replacement.source, dictionary);
  assert.ok(state.getSnapshot().revision > before.revision);
  assert.match(state.getSnapshot().text, /added/);
  assert.ok(edits.every((edit) => edit.start === before.text.length));
  state.disconnect();
  h.dispose();
  replacement.dispose();
});

test('a queued old-generation batch cannot leak into the panel or break the next revision', async () => {
  const h = harness();
  const state = new DiagramCodeProjectionState();
  h.tables.set('a', createTableYMap('initial', { x: 0, y: 0 }, []));
  h.ready(true);
  state.connect(true, h.source, dictionary);
  const initial = state.getSnapshot();
  h.tables.get('a')!.set('label', 'queued');
  h.ready(false);
  await Promise.resolve();
  assert.equal(state.getSnapshot().text, initial.text);
  h.tables.get('a')!.set('label', 'authoritative');
  h.ready(true);
  state.refreshReadiness();
  assert.equal(state.getSnapshot().status, 'ready');
  assert.match(state.getSnapshot().text, /authoritative/);
  assert.ok(state.getSnapshot().revision > initial.revision);
  state.disconnect();
  h.dispose();
});

test('the React hook wires hydration, patch stream and generation resync without recreating the port', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const { default: ts } = await import('typescript');
  const effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  const pending: (() => void)[] = [];
  let effectIndex = 0;
  let controller: DiagramCodeProjectionState | undefined;
  const react = {
    useState: (initialize: () => DiagramCodeProjectionState) => [(controller ??= initialize())],
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const index = effectIndex++;
      const previous = effects[index];
      if (previous && previous.deps.every((value, i) => Object.is(value, deps[i]))) return;
      pending.push(() => {
        previous?.cleanup?.();
        effects[index] = { deps, cleanup: effect() };
      });
    },
  };
  const module = { exports: {} as Record<string, unknown> };
  const js = ts.transpileModule(
    readFileSync('src/collaboration/channel/diagram/use-diagram-code-projection.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  runInNewContext(js, {
    module,
    exports: module.exports,
    require: (name: string) => (name === 'react' ? react : { DiagramCodeProjectionState }),
  });
  const hook = module.exports
    .useDiagramCodeProjection as typeof import('../../src/collaboration/channel/diagram/use-diagram-code-projection.js').useDiagramCodeProjection;
  const h = harness();
  let subscriptions = 0;
  const source = {
    ...h.source,
    read: {
      execute: h.source.read.execute.bind(h.source.read),
      getRevision: () => h.source.read.getRevision(),
      subscribe: (listener: Parameters<typeof h.source.read.subscribe>[0]) => {
        subscriptions++;
        return h.source.read.subscribe(listener);
      },
    },
  };
  let generation = 0;
  /** 실제 훅을 렌더하고 의존성이 바뀐 효과만 실행한다. */
  function render() {
    effectIndex = 0;
    const result = hook(true, { source, ready: source.isReady(), generation }, dictionary);
    pending.splice(0).forEach((effect) => effect());
    return result;
  }
  assert.equal(render().status, 'hydrating');
  h.tables.set('a', createTableYMap('hydrated', { x: 0, y: 0 }, []));
  h.ready(true);
  generation++;
  render();
  assert.equal(render().status, 'ready');
  const batches: number[] = [];
  const unsubscribe = render().subscribePatches(({ batch }) => batches.push(batch.nextRevision));
  h.tables.get('a')!.set('label', 'patched');
  await Promise.resolve();
  assert.match(render().text, /patched/);
  assert.equal(batches.length, 1);
  h.ready(false);
  generation++;
  render();
  assert.equal(render().status, 'resync');
  h.tables.get('a')!.set('label', 'resynced');
  h.ready(true);
  generation++;
  render();
  assert.match(render().text, /resynced/);
  assert.equal(subscriptions, 1);
  unsubscribe();
  effects.forEach((effect) => effect.cleanup?.());
  h.dispose();
});

test('shared draft notices include legacy root text and never change either draft', async () => {
  const h = harness();
  h.doc.getText('codeModeSharedDraftText').insert(0, 'unapplied legacy text');
  let updates = 0;
  h.doc.on('update', () => updates++);
  h.ready(true);
  const state = new DiagramCodeProjectionState();
  state.connect(true, h.source, dictionary);
  const { hasUnappliedSharedProjectionDraft } =
    await import('../../src/collaboration/channel/diagram/use-diagram-unapplied-shared-draft.js');
  assert.equal(hasUnappliedSharedProjectionDraft(h.doc), true);
  assert.equal(updates, 0);
  assert.equal(h.doc.getText('codeModeSharedDraftText').toString(), 'unapplied legacy text');
  state.disconnect();
  h.dispose();
});
