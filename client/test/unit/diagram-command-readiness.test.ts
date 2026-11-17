import { sourceHookHarness } from '../helpers/source-hook-harness.js';
import {
  createDiagramWorkModeCapabilities,
  resolveDiagramWorkModeRuntimeState,
} from '../../src/lib/diagram-work-mode.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDiagramDocumentRuntime } from '../../src/collaboration/channel/diagram/use-diagram-document-runtime.js';
import { useDiagramCollaborationStoreBridge } from '../../src/collaboration/channel/diagram/use-diagram-collaboration-store-bridge.js';
import type { DocumentMutationSession } from '../../src/collaboration/core/session/document-mutation-session.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import {
  createDiagramDocumentMutationSession,
  isDiagramDocumentReady,
} from '../../src/collaboration/channel/diagram/diagram-document-mutation-session.js';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import {
  ErdDocumentPlugin,
  isErdCanvasInputAdapter,
} from '../../src/collaboration/plugins/erd/erd-document-plugin.js';
import { getTablesMap } from '../../src/collaboration/yjsBridge.js';

for (const blocked of [
  { hydrated: false },
  { canEdit: false },
  { connectionStatus: 'disconnected' },
  { connectionStatus: 'reconnecting' },
  { synced: false },
]) {
  test(`dispatch reads current readiness and blocks without writes: ${JSON.stringify(blocked)}`, () => {
    const h = harness();
    assert.equal(h.session.emitCommand(h.adapter.addTable('first')), 'applied');
    h.setReady(() =>
      isDiagramDocumentReady({
        localOnly: false,
        canEdit: true,
        hydrated: true,
        synced: true,
        connectionStatus: 'connected',
        ...blocked,
      }),
    );
    const before = Y.encodeStateAsUpdate(h.doc);
    assert.equal(h.session.emitCommand(h.adapter.addTable('blocked')), 'rejected');
    assert.equal(
      h.session.emitCommand({
        key: 'schema-draft:positions',
        payload: { positions: { draft: { x: 3, y: 5 } } },
      }),
      'rejected',
    );
    assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
    h.setReady(() => true);
    assert.equal(h.session.emitCommand(h.adapter.addTable('reconnected')), 'applied');
    h.doc.destroy();
  });
}

function harness() {
  const doc = new Y.Doc();
  const engine = new YjsSharedDocumentEngine(doc);
  const revisions = new DocumentRevisionTracker();
  const store = new DocumentStore(
    new ErdDocumentMutationApplier(engine),
    revisions,
    new ErdDocumentReadContextFactory(engine, revisions),
    () => engine.exportSnapshot(),
    () => [],
  );
  const plugin = new ErdDocumentPlugin();
  const context = { read: store };
  const inputAdapters = plugin.createInputAdapters(context);
  const adapter = inputAdapters.canvas;
  assert.ok(isErdCanvasInputAdapter(adapter));
  let ready = () => true;
  const session = createDiagramDocumentMutationSession(
    store,
    plugin.createMutationPolicy(context),
    inputAdapters,
    () => ready(),
    () => {},
  );
  return {
    doc,
    session,
    adapter,
    setReady: (next: () => boolean) => {
      ready = next;
    },
  };
}

test('local-only document session supports table/column/group CRUD and layout', () => {
  const doc = new Y.Doc();
  const engine = new YjsSharedDocumentEngine(doc);
  let session: DocumentMutationSession | null = null;
  let ready = true;
  function LocalRuntime() {
    session = useDiagramDocumentRuntime({
      diagram: undefined,
      documentBootstrap: undefined,
      resolvedSessionBootstrap: null,
      sharedDocumentEngine: engine,
      snapshotCodec: null,
      storeBridge: useDiagramCollaborationStoreBridge(),
      plugin: new ErdDocumentPlugin(),
      isCommandReady: () => ready,
    }).documentMutationSession;
    return null;
  }
  renderToStaticMarkup(createElement(LocalRuntime));
  assert.ok(session);
  const localSession = session as DocumentMutationSession;
  const adapter = localSession.inputAdapters?.canvas;
  assert.ok(isErdCanvasInputAdapter(adapter));
  const h = { doc, session: localSession, adapter };
  assert.equal(
    isDiagramDocumentReady({
      localOnly: true,
      canEdit: true,
      hydrated: false,
      synced: false,
      connectionStatus: 'disconnected',
    }),
    true,
  );
  assert.equal(h.session.emitCommand(h.adapter.addTable('local')), 'applied');
  const tableId = [...getTablesMap(h.doc).keys()][0];
  assert.equal(h.session.emitCommand(h.adapter.addColumn(tableId)), 'applied');
  assert.equal(h.session.emitCommand(h.adapter.renameTable(tableId, 'renamed')), 'applied');
  assert.equal(h.session.emitCommand(h.adapter.addGroup('local group')), 'applied');
  const table = getTablesMap(h.doc).get(tableId)!;
  assert.equal(
    h.session.emitCommand(
      h.adapter.applyLayout({
        version: 1,
        batchId: 'local',
        entries: [
          {
            tableId,
            from: { x: table.get('positionX') as number, y: table.get('positionY') as number },
            to: { x: 50, y: 90 },
          },
        ],
      }),
    ),
    'applied',
  );
  assert.equal(table.get('positionX'), 50);
  assert.equal(h.session.emitCommand(h.adapter.deleteTable(tableId)), 'applied');
  ready = false;
  assert.equal((localSession as { readonly ready?: boolean }).ready, false);
  h.doc.destroy();
});

for (const ready of [false, true]) {
  test(`UI edit policy uses document readiness: ${ready}`, () => {
    const h = sourceHookHarness('src/pages/diagram/use-diagram-page-runtime-state.ts', {
      'diagram-work-mode': { resolveDiagramWorkModeRuntimeState },
      'shared-schema-draft': { hasSharedSchemaDraftContent: () => false },
    });
    const hook = h.exports.useDiagramPageRuntimeState as (params: unknown) => {
      workModeRuntimeState: { effectiveCanvasCanEdit: boolean; effectiveCodeCanEdit: boolean };
    };
    const result = h.render(() =>
      hook({
        canEdit: true,
        documentCommandReady: ready,
        groups: [],
        persistedNodes: [],
        persistedEdges: [],
        workMode: 'erd',
        workModeCapabilities: createDiagramWorkModeCapabilities('erd'),
        sharedSchemaDraft: null,
        t: (key: string) => key,
      }),
    );
    assert.equal(result.workModeRuntimeState.effectiveCanvasCanEdit, ready);
    assert.equal(result.workModeRuntimeState.effectiveCodeCanEdit, false);
  });
}

test('runtime reads disconnect, reconnect sync, hydration and permission changes before dispatch', () => {
  let connectionStatus = 'connected';
  let isReady = () => false;
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/use-diagram-collaboration-runtime.ts',
    {
      useCollaborationStore: {
        __esModule: true,
        default: Object.assign(() => connectionStatus, { getState: () => ({ connectionStatus }) }),
      },
      useCanvasStore: { __esModule: true, default: () => () => {} },
      'diagram-document-mutation-session': { isDiagramDocumentReady },
      'use-diagram-collaboration-store-bridge': { useDiagramCollaborationStoreBridge: () => ({}) },
      'use-diagram-runtime-bootstrap': {
        useDiagramRuntimeBootstrap: () => ({
          collaborationBootstrap: {},
          previewEnabled: true,
          sharedDocumentEngine: { exportSnapshot: () => new Uint8Array([0, 0]) },
          snapshotCodec: {},
          contentOnlySnapshotSeeder: {},
        }),
      },
      'use-collaboration-session': { useCollaborationSession: () => ({ runtimeState: 'live' }) },
      'collaboration-preview-sync-status': { toPreviewSyncStatus: () => 'live' },
      'use-diagram-document-runtime': {
        useDiagramDocumentRuntime: (params: { isCommandReady: () => boolean }) => {
          isReady = params.isCommandReady;
          return {};
        },
      },
      'create-diagram-collaboration-provider-lifecycle': {
        createDiagramCollaborationProviderLifecycle: (options: unknown) => options,
      },
    },
  );
  const hook = h.exports.useDiagramCollaborationRuntime as (...args: unknown[]) => {
    createProviderLifecycle: (params: unknown) => {
      onProviderReady: (provider: unknown) => void;
      updatePreviewMode: (preview: boolean) => void;
      onSyncStateChange: (synced: boolean) => void;
    };
  };
  const render = (canEdit = true) => h.render(() => hook(undefined, undefined, 0, canEdit));
  const runtime = render();
  const lifecycle = runtime.createProviderLifecycle({
    diagramId: 'd',
    updatePreviewMode: () => {},
    onProviderReady: () => {},
    onProviderDisposed: () => {},
  });
  lifecycle.onProviderReady({});
  assert.equal(isReady(), false);
  lifecycle.onSyncStateChange(true);
  assert.equal(isReady(), false, 'preview가 수화되기 전에는 동기화만으로 편집할 수 없다');
  lifecycle.updatePreviewMode(false);
  assert.equal(isReady(), true);
  render();
  connectionStatus = 'disconnected';
  assert.equal(isReady(), false, '리렌더 전에도 단절을 검사한다');
  connectionStatus = 'reconnecting';
  lifecycle.onSyncStateChange(false);
  assert.equal(isReady(), false);
  connectionStatus = 'connected';
  assert.equal(isReady(), false, '재접속 후 재동기화까지 차단한다');
  lifecycle.onSyncStateChange(true);
  assert.equal(isReady(), true);
  render(false);
  assert.equal(isReady(), false);
});

for (const hasYdocSnapshot of [false, true]) {
  test(`empty content, snapshot=${hasYdocSnapshot}: explicit empty confirmation or real sync permits commands`, () => {
    let connectionStatus = 'connected';
    let isReady = () => false;
    const engine = { exportSnapshot: () => new Uint8Array([0, 0]) };
    const h = sourceHookHarness(
      'src/collaboration/channel/diagram/use-diagram-collaboration-runtime.ts',
      {
        useCollaborationStore: {
          __esModule: true,
          default: Object.assign(() => connectionStatus, {
            getState: () => ({ connectionStatus }),
          }),
        },
        useCanvasStore: { __esModule: true, default: () => () => {} },
        'diagram-document-mutation-session': { isDiagramDocumentReady },
        'use-diagram-collaboration-store-bridge': {
          useDiagramCollaborationStoreBridge: () => ({}),
        },
        'use-diagram-runtime-bootstrap': {
          useDiagramRuntimeBootstrap: () => ({
            collaborationBootstrap: { hasYdocSnapshot, content: null },
            previewEnabled: false,
            sharedDocumentEngine: engine,
            snapshotCodec: {},
            contentOnlySnapshotSeeder: {},
          }),
        },
        'use-collaboration-session': { useCollaborationSession: () => ({ runtimeState: 'live' }) },
        'collaboration-preview-sync-status': { toPreviewSyncStatus: () => 'live' },
        'use-diagram-document-runtime': {
          useDiagramDocumentRuntime: (params: { isCommandReady: () => boolean }) => {
            isReady = params.isCommandReady;
            return {};
          },
        },
        'create-diagram-collaboration-provider-lifecycle': {
          createDiagramCollaborationProviderLifecycle: (options: unknown) => options,
        },
      },
    );
    const hook = h.exports.useDiagramCollaborationRuntime as (...args: unknown[]) => {
      createProviderLifecycle: (params: unknown) => {
        onProviderReady: (provider: unknown) => void;
        onConnectionStatusChange: (status: string) => void;
        onSyncStateChange: (synced: boolean) => void;
        onEmptyDocumentInitialized: () => void;
      };
    };
    const runtime = h.render(() => hook(undefined, undefined, 0, true));
    const params = { diagramId: 'd', onProviderReady: () => {}, onProviderDisposed: () => {} };
    // StrictMode에서 폐기된 provider의 지연 응답을 무시한다.
    const abandoned = runtime.createProviderLifecycle(params);
    abandoned.onProviderReady({});
    const lifecycle = runtime.createProviderLifecycle(params);
    lifecycle.onProviderReady({});
    lifecycle.onConnectionStatusChange?.('connected');
    assert.equal(isReady(), false);
    abandoned.onEmptyDocumentInitialized();
    assert.equal(isReady(), false, '이전 provider의 확인 응답은 무시한다');
    lifecycle.onEmptyDocumentInitialized();
    assert.equal(isReady(), !hasYdocSnapshot);
    let writes = 0;
    const dispatch = () => {
      if (isReady()) writes++;
    };
    if (hasYdocSnapshot) {
      dispatch();
      assert.equal(writes, 0);
    }
    connectionStatus = 'disconnected';
    lifecycle.onConnectionStatusChange?.('disconnected');
    connectionStatus = 'connected';
    lifecycle.onConnectionStatusChange?.('connected');
    dispatch();
    assert.equal(writes, 0, '재연결에는 이전 빈 방 확인을 재사용하지 않는다');
    lifecycle.onSyncStateChange(true);
    dispatch();
    assert.equal(writes, 1);
    const replacement = runtime.createProviderLifecycle(params);
    replacement.onProviderReady({});
    replacement.onConnectionStatusChange?.('connected');
    assert.equal(isReady(), false, 'provider 재생성도 초기 확인을 다시 기다린다');
    lifecycle.onSyncStateChange(true);
    assert.equal(isReady(), false, '폐기된 provider의 지연 이벤트도 무시한다');
  });
}

test('shared draft position command writes through dispatch while local VIEWER restore stays local', () => {
  const d = harness();
  const positions = { draft: { x: 10, y: 20 } };
  let sharedWrites = 0;
  const h = sourceHookHarness('src/pages/diagram/use-diagram-page-runtime-state.ts', {
    'diagram-work-mode': { resolveDiagramWorkModeRuntimeState },
    'shared-schema-draft': { hasSharedSchemaDraftContent: () => false },
  });
  const hook = h.exports.useDiagramPageRuntimeState as (params: unknown) => {
    handleLocalSchemaDraftPositionsChange: (positions: unknown) => void;
    dslPreviewPositionOverrides: unknown;
  };
  const render = () =>
    h.render(() =>
      hook({
        canEdit: false,
        documentCommandReady: false,
        groups: [],
        persistedNodes: [],
        persistedEdges: [],
        workMode: 'code',
        workModeCapabilities: createDiagramWorkModeCapabilities('code'),
        sharedSchemaDraft: null,
        t: (key: string) => key,
        writePreviewPositionOverrides: () => sharedWrites++,
      }),
    );
  let updates = 0;
  d.doc.on('update', () => updates++);
  render().handleLocalSchemaDraftPositionsChange(positions);
  assert.deepEqual(render().dslPreviewPositionOverrides, positions);
  assert.equal(sharedWrites, 0);
  assert.equal(updates, 0);
  assert.equal(
    d.session.emitCommand({ key: 'schema-draft:positions', payload: { positions } }),
    'applied',
  );
  assert.equal(updates, 1);
  assert.deepEqual(
    JSON.parse(d.doc.getMap('sharedSchemaDraft').get('positions') as string),
    positions,
  );
  d.doc.destroy();
});
