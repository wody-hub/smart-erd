import assert from 'node:assert/strict';
import test from 'node:test';
import * as Y from 'yjs';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';
import * as legacyDraft from '../../src/lib/code-mode-shared-draft.js';
import * as schemaDraft from '../../src/lib/shared-schema-draft.js';
import { isDiagramDocumentReady } from '../../src/collaboration/channel/diagram/diagram-document-mutation-session.js';

test('first remotely created root draft immediately shows notice without local document writes', () => {
  const doc = new Y.Doc();
  const remote = new Y.Doc();
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/use-diagram-unapplied-shared-draft.ts',
    {
      'shared-schema-draft': schemaDraft,
      'code-mode-shared-draft': legacyDraft,
    },
  );
  const hook = h.exports.useDiagramUnappliedSharedDraft as (runtime: unknown) => boolean;
  const runtime = { ready: true, source: { getDocument: () => doc }, generation: 0 };
  assert.equal(
    h.render(() => hook(runtime)),
    false,
  );
  h.runEffects();
  const localUpdates: unknown[] = [];
  doc.on('update', (_update, origin) => {
    if (origin !== 'remote') localUpdates.push(origin);
  });
  legacyDraft.replaceCodeModeSharedDraftText(remote, 'first remote draft', 'test');
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), 'remote');
  assert.equal(legacyDraft.readCodeModeSharedDraftText(doc), 'first remote draft');
  assert.equal(
    h.render(() => hook(runtime)),
    true,
  );
  assert.deepEqual(localUpdates, []);
  h.cleanup();
  doc.destroy();
  remote.destroy();
});

for (const enabled of [false, true]) {
  test(`full collaboration runtime projection enabled=${enabled} gates store/doc reads and subscriptions`, () => {
    let reads = 0;
    let subscriptions = 0;
    let docReads = 0;
    const source = {
      get read() {
        docReads++;
        return {
          subscribe: () => {
            subscriptions++;
          },
        };
      },
      getDocument: () => {
        docReads++;
        return new Y.Doc();
      },
    };
    const h = sourceHookHarness(
      'src/collaboration/channel/diagram/use-diagram-collaboration-runtime.ts',
      {
        useCollaborationStore: {
          __esModule: true,
          default: Object.assign(() => 'connected', {
            getState: () => {
              reads++;
              return { connectionStatus: 'connected' };
            },
          }),
        },
        useCanvasStore: { __esModule: true, default: () => () => {} },
        'diagram-document-mutation-session': { isDiagramDocumentReady },
        'use-diagram-collaboration-store-bridge': {
          useDiagramCollaborationStoreBridge: () => ({}),
        },
        'use-diagram-runtime-bootstrap': {
          useDiagramRuntimeBootstrap: () => ({
            collaborationBootstrap: {},
            previewEnabled: false,
            sharedDocumentEngine: { exportSnapshot: () => new Uint8Array([0, 0]) },
            snapshotCodec: {},
            contentOnlySnapshotSeeder: {},
          }),
        },
        'use-collaboration-session': { useCollaborationSession: () => ({ runtimeState: 'live' }) },
        'collaboration-preview-sync-status': { toPreviewSyncStatus: () => 'live' },
        'use-diagram-document-runtime': {
          useDiagramDocumentRuntime: () => ({ codeProjectionRead: source }),
        },
        'create-diagram-collaboration-provider-lifecycle': {
          createDiagramCollaborationProviderLifecycle: (options: unknown) => options,
        },
      },
    );
    const hook = h.exports.useDiagramCollaborationRuntime as (...args: unknown[]) => {
      codeProjectionRuntime: { source: unknown; ready: boolean; generation: unknown };
      createProviderLifecycle: (params: unknown) => {
        onSyncStateChange: (synced: boolean) => void;
      };
    };
    const render = () => h.render(() => hook(undefined, undefined, 0, true, enabled));
    const first = render();
    first.createProviderLifecycle({ diagramId: 'd' }).onSyncStateChange(true);
    reads = 0;
    docReads = 0;
    const result = render().codeProjectionRuntime;
    assert.equal(result.ready, enabled);
    assert.equal(reads, enabled ? 1 : 0);
    assert.equal(docReads, enabled ? 1 : 0);
    assert.equal(subscriptions, 0);
    if (!enabled) assert.equal(result.source, null);
    h.cleanup();
  });
}

test('panel empty batches never read or restore selection/viewport or update decorations', async () => {
  const { createProjectionMonacoModel } = await import('../helpers/projection-monaco-model.js');
  const projectionModel = await import('../../src/lib/dsl-live-projection-model.js');
  const { generateProjection } = await import('../../src/lib/dsl-block-projection.js');
  const model = await createProjectionMonacoModel();
  const before = generateProjection({
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: ['a', 'b'].map((id) => ({ id, data: { label: id, columns: [] } })),
  });
  let listener: ((event: unknown) => void) | undefined;
  let decorationUpdates = 0;
  const h = sourceHookHarness('src/components/erd/DslLiveProjectionPanel.tsx', {
    'use-diagram-code-projection': {
      useDiagramCodeProjection: () => ({
        ...before,
        getSnapshot: () => before,
        subscribePatches: (next: typeof listener) => {
          listener = next;
          return () => {};
        },
      }),
    },
    'use-diagram-unapplied-shared-draft': { useDiagramUnappliedSharedDraft: () => false },
    ErdDictionaryContext: {
      useErdDictionary: () => ({ terms: [], domains: [], dictionaryRevision: 0 }),
    },
    'react-i18next': { useTranslation: () => ({ t: (key: string) => key }) },
    'dsl-live-projection-model': projectionModel,
  });
  const panel = h.exports.default as (params: unknown) => unknown;
  /** React 트리에서 Editor의 마운트 콜백을 찾는다. */
  function findMount(value: unknown): ((...args: unknown[]) => void) | undefined {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.map(findMount).find(Boolean);
    const props = (
      value as { props?: { onMount?: (...args: unknown[]) => void; children?: unknown } }
    ).props;
    return props?.onMount ?? findMount(props?.children);
  }
  const mount = findMount(h.render(() => panel({ diagramId: 'd', runtime: {} })));
  assert.ok(mount);
  const editor = new Proxy(
    {
      getModel: () => model,
      createDecorationsCollection: () => ({
        set: () => {
          decorationUpdates++;
        },
        clear() {},
      }),
    },
    {
      get: (target, key) => {
        assert.ok(key in target, `empty batch unexpectedly accessed editor.${String(key)}`);
        return target[key as keyof typeof target];
      },
    },
  );
  mount(editor, {});
  assert.ok(listener);
  listener({
    batch: { baseRevision: 1, nextRevision: 2, patches: [], blockMetadata: before.blocks },
    snapshot: { ...before, revision: 2 },
    receivedAt: 0,
  });
  assert.equal(decorationUpdates, 0);
  assert.equal(model.getValue(), before.text);
  h.runEffects();
  h.cleanup();
  model.dispose();
});
