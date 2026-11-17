import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import * as Y from 'yjs';
import {
  useDiagramErdCrudActions,
  type DiagramErdCrudActions,
} from '../../src/collaboration/channel/diagram/use-diagram-erd-crud-actions.js';
import {
  DocumentMutationSessionContext,
  type DocumentMutationSession,
} from '../../src/collaboration/core/session/document-mutation-session.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { ErdDocumentPlugin } from '../../src/collaboration/plugins/erd/erd-document-plugin.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { ensureColumnStorage } from '../../src/collaboration/yjs-columns.js';
import {
  createTableYMap,
  createGroupYMap,
  getTablesMap,
  getGroupsMap,
} from '../../src/collaboration/yjsBridge.js';
import useCanvasStore from '../../src/stores/erd/useCanvasStore.js';

import {
  useDiagramErdEdgeActions,
  type DiagramErdEdgeActions,
} from '../../src/collaboration/channel/diagram/use-diagram-erd-edge-actions.js';
import {
  useDiagramErdDragActions,
  type DiagramErdDragActions,
} from '../../src/collaboration/channel/diagram/use-diagram-erd-drag-actions.js';
import {
  useDiagramErdApplyActions,
  type DiagramErdApplyActions,
} from '../../src/collaboration/channel/diagram/use-diagram-erd-apply-actions.js';
import {
  useDiagramDictionaryReconciliationActions,
  type DiagramDictionaryReconciliationActions,
} from '../../src/collaboration/channel/diagram/use-diagram-dictionary-reconciliation-actions.js';
import {
  createEdgeYMap,
  createWaypointsYArray,
  getEdgesMap,
} from '../../src/collaboration/yjsBridge.js';
import { buildDiffPlanSummary } from '../../src/lib/erd-diff-plan.js';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import {
  createDiagramDocumentMutationSession,
  isDiagramDocumentReady,
} from '../../src/collaboration/channel/diagram/diagram-document-mutation-session.js';

type Actions = DiagramErdCrudActions &
  DiagramErdEdgeActions &
  DiagramErdApplyActions &
  DiagramErdDragActions &
  DiagramDictionaryReconciliationActions;
const ddl = {
  tables: [{ name: 'imported', columns: [] }],
  relations: [],
  errors: [],
  diagnostics: [],
  tableRanges: [],
};
const cases: { key: string; run: (actions: Actions) => unknown; success?: unknown }[] = [
  {
    key: 'edge:connect',
    run: (a) =>
      a.connectEdge('a', 'b', 'a-id-source-right', 'b-name-target-left', 'non-identifying'),
  },
  {
    key: 'edge:add-fk-relation',
    run: (a) =>
      a.addFkRelation({
        parentNodeId: 'a',
        childNodeId: 'b',
        relationType: 'identifying',
        pkColumns: [{ id: 'id', name: 'id', type: 'BIGINT', pk: true }],
        parentLabel: 'a',
        existingNames: ['id', 'name'],
      }),
    success: 1,
  },
  { key: 'edge:delete', run: (a) => a.deleteEdge('e') },
  { key: 'edge:delete', run: (a) => a.deleteEdge('e', true) },
  { key: 'edge:update-routing-type', run: (a) => a.updateEdgeRoutingType('e', 'smoothstep') },
  {
    key: 'edge:update-handle-selection',
    run: (a) => a.updateEdgeHandleSelection('e', 'left-right'),
  },
  { key: 'edge:update-waypoints', run: (a) => a.updateEdgeWaypoints('e', [{ x: 60, y: 70 }]) },
  { key: 'edge:reset-waypoints', run: (a) => a.resetEdgeWaypoints('e') },
  { key: 'edge:normalize-handles', run: (a) => a.normalizeEdgeHandles(['a'], 'edge') },
  { key: 'ddl:import', run: (a) => a.importDdl(ddl) },
  { key: 'ddl:replace', run: (a) => a.replaceFromDdl(ddl) },
  {
    key: 'diff:apply-plan',
    run: (a) =>
      a.applyDiffPlan({
        meta: { version: 'v1', createdAt: 0, fallbackRequired: false, fallbackReasons: [] },
        tables: [{ op: 'add', entity: 'table', next: { name: 'diff_added', columns: [] } }],
        columns: [],
        edges: [],
        summary: buildDiffPlanSummary({ tables: [], columns: [], edges: [] }),
      }),
  },
  { key: 'group:update-tables', run: (a) => a.updateGroupTables('g', ['b'], ['a']) },
  {
    key: 'dictionary:reconcile',
    run: (a) =>
      a.reconcile({
        tableMetaUpdates: [],
        columnUpdates: [{ nodeId: 'a', colId: 'id', updates: { logicalName: '사전 이름' } }],
      }),
  },
];
/** 실제 문서 명령과 캔버스 투영을 연결하고 훅의 반환 액션을 얻는다. */
async function harness(language: string, mode: string) {
  const doc = new Y.Doc();
  for (const id of ['a', 'b']) {
    const table = createTableYMap(id, { x: 0, y: 0 }, [
      { id: 'id', name: 'id', type: 'BIGINT', pk: true },
      { id: 'name', name: 'name', type: 'TEXT' },
    ]);
    getTablesMap(doc).set(id, table);
    ensureColumnStorage(table);
  }
  const group = createGroupYMap('group');
  getGroupsMap(doc).set('g', group);
  (group.get('tableIds') as Y.Array<string>).push(['a']);
  const edge = createEdgeYMap('a', 'b', 'a-id-source-right', 'b-name-target-left');
  getEdgesMap(doc).set('e', edge);
  useCanvasStore.getState().initYDoc(doc);
  edge.set('routingType', 'straight');
  edge.set('waypoints', createWaypointsYArray([{ x: 10, y: 20 }]));
  // 초기 정규화 이후 남은 레거시 핸들도 명령 경로로 정리한다.
  edge.set('sourceHandle', 'a-id-source');
  useCanvasStore.getState().syncFromYDoc();
  const engine = new YjsSharedDocumentEngine(doc);
  const factory = new ErdDocumentReadContextFactory(engine, new DocumentRevisionTracker());
  const read: DocumentMutationSession['read'] = {
    getRevision: () => 'test',
    execute: (query) => query.run(factory.create()),
    exportSnapshot: () => Y.encodeStateAsUpdate(doc),
  };
  const plugin = new ErdDocumentPlugin();
  const policy = plugin.createMutationPolicy({ read });
  const applier = new ErdDocumentMutationApplier(engine);
  const readySession = createDiagramDocumentMutationSession(
    new DocumentStore(
      applier,
      new DocumentRevisionTracker(),
      factory,
      () => Y.encodeStateAsUpdate(doc),
      () => [],
    ),
    policy,
    plugin.createInputAdapters({ read }),
    () =>
      isDiagramDocumentReady({
        localOnly: false,
        canEdit: mode !== 'viewer',
        hydrated: mode !== 'hydrating',
        synced: true,
        connectionStatus: mode === 'disconnected' ? 'disconnected' : 'connected',
      }),
    () => {},
  );
  const commands: string[] = [];
  let dispatching = false;
  let updates = 0;
  let allowProjection = false;
  const unsubscribe = useCanvasStore.subscribe(() => {
    if (!allowProjection) assert.ok(dispatching, '문서 명령 밖에서 스토어를 변경하면 안 된다');
  });
  doc.on('update', () => {
    assert.ok(dispatching, '문서 명령 밖에서 쓰기가 발생하면 안 된다');
    updates++;
  });
  const session: DocumentMutationSession = {
    enabled: mode !== 'disabled',
    inputAdapters: mode === 'missing-adapter' ? null : plugin.createInputAdapters({ read }),
    read,
    emitCommand: (command) => {
      commands.push(command.key);
      if (!['applied', 'hydrating', 'disconnected', 'viewer'].includes(mode))
        return mode === 'rejected' ? 'rejected' : 'unavailable';
      dispatching = true;
      try {
        return readySession.emitCommand(command);
      } finally {
        dispatching = false;
      }
    },
    emitCommandWithResult: (command) => {
      commands.push(command.key);
      if (!['applied', 'hydrating', 'disconnected', 'viewer'].includes(mode))
        return { status: mode === 'unavailable' ? 'unavailable' : 'rejected' };
      dispatching = true;
      try {
        return readySession.emitCommandWithResult(command);
      } finally {
        dispatching = false;
      }
    },
  };
  const i18n = createInstance();
  const translation = JSON.parse(
    readFileSync(`src/i18n/locales/${language}/translation.json`, 'utf8'),
  );
  await i18n.init({
    showSupportNotice: false,
    lng: language,
    resources: { [language]: { translation } },
  });
  let actions!: Actions;
  function Probe() {
    actions = {
      ...useDiagramErdCrudActions(),
      ...useDiagramErdEdgeActions(),
      ...useDiagramErdApplyActions(),
      ...useDiagramErdDragActions(),
      ...useDiagramDictionaryReconciliationActions(),
    };
    return null;
  }
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        DocumentMutationSessionContext.Provider,
        { value: mode === 'no-session' ? null : session },
        createElement(Probe),
      ),
    ),
  );
  return {
    doc,
    actions,
    commands,
    i18n,
    unsubscribe,
    updates: () => updates,
    allowProjection: () => {
      allowProjection = true;
    },
  };
}

for (const item of cases) {
  for (const mode of [
    'no-session',
    'disabled',
    'missing-adapter',
    'unavailable',
    'rejected',
    'hydrating',
    'disconnected',
    'viewer',
  ]) {
    test(`${item.key}: ${mode} rejects without store/doc writes and toasts once`, async (t) => {
      const warning = t.mock.method(toast, 'warning', () => 'warning');
      const h = await harness('ko', mode);
      try {
        const before = Y.encodeStateAsUpdate(h.doc);
        const state = useCanvasStore.getState();
        assert.equal(
          item.run(h.actions),
          item.key === 'diff:apply-plan' ? null : item.success === 1 ? 0 : 'rejected',
        );
        assert.equal(useCanvasStore.getState(), state);
        assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
        assert.equal(h.updates(), 0);
        assert.equal(warning.mock.callCount(), 1);
        assert.equal(warning.mock.calls[0].arguments[1]?.id, 'diagram-command-rejected');
      } finally {
        h.unsubscribe();
        useCanvasStore.getState().destroyYDoc();
        h.doc.destroy();
      }
    });
  }
  test(`${item.key}: success writes once through the document command`, async (t) => {
    const warning = t.mock.method(toast, 'warning', () => 'warning');
    const h = await harness('ko', 'applied');
    try {
      const result = item.run(h.actions);
      if (item.key === 'diff:apply-plan') assert.ok(result);
      else assert.equal(result, item.success ?? 'applied');
      assert.deepEqual(h.commands, [item.key]);
      assert.equal(h.updates(), 1);
      assert.equal(warning.mock.callCount(), 0);
    } finally {
      h.unsubscribe();
      useCanvasStore.getState().destroyYDoc();
      h.doc.destroy();
    }
  });
}

for (const mode of [
  'no-session',
  'unavailable',
  'rejected',
  'hydrating',
  'disconnected',
  'viewer',
  'applied',
]) {
  test(`drag-end ${mode}: finalizes from the document with no legacy flush`, async (t) => {
    const warning = t.mock.method(toast, 'warning', () => 'warning');
    const h = await harness('ko', mode);
    try {
      h.allowProjection();
      const before = Y.encodeStateAsUpdate(h.doc);
      useCanvasStore
        .getState()
        .onNodesChange([
          { id: 'a', type: 'position', position: { x: 900, y: 800 }, dragging: true },
        ]);
      // 이전 큐가 남아 있어도 종료 시 문서로 직접 flush하지 않는다.
      useCanvasStore.getState().internal.tablePositionQueue.pending.set('a', { x: 999, y: 999 });
      h.actions.commitTableDrag('a', { x: 900, y: 800 });
      const node = useCanvasStore.getState().nodes.find((node) => node.id === 'a')!;
      assert.deepEqual(node.position, mode === 'applied' ? { x: 900, y: 800 } : { x: 0, y: 0 });
      assert.equal(node.dragging, false);
      assert.equal(useCanvasStore.getState().internal.isNodeDragging, false);
      assert.equal(useCanvasStore.getState().internal.tablePositionQueue.pending.size, 0);
      assert.equal(h.updates(), mode === 'applied' ? 1 : 0);
      assert.equal(warning.mock.callCount(), mode === 'applied' ? 0 : 1);
      if (mode !== 'applied') assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
      else {
        assert.deepEqual(h.commands, ['table:move']);
        assert.notEqual(getEdgesMap(h.doc).get('e')!.get('sourceHandle'), 'a-id-source');
      }
    } finally {
      h.unsubscribe();
      useCanvasStore.getState().destroyYDoc();
      h.doc.destroy();
    }
  });
}
