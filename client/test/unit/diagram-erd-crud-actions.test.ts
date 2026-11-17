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

const cases: { key: string; run: (actions: DiagramErdCrudActions) => string }[] = [
  { key: 'table:add', run: (a) => a.addTable('new_table') },
  { key: 'table:delete', run: (a) => a.deleteTable('a') },
  { key: 'table:move', run: (a) => a.moveTable('a', 40, 50) },
  { key: 'table:rename', run: (a) => a.renameTable('a', 'renamed') },
  { key: 'table:update-meta', run: (a) => a.updateTableMeta('a', { logicalTableName: '논리명' }) },
  { key: 'column:add', run: (a) => a.addColumn('a') },
  { key: 'column:delete', run: (a) => a.deleteColumn('a', 'id') },
  { key: 'column:move', run: (a) => a.moveColumn('a', 0, 1) },
  { key: 'column:update', run: (a) => a.updateColumn('a', 'id', { name: 'renamed_id' }) },
  { key: 'group:add', run: (a) => a.addGroup('new_group') },
  { key: 'group:delete', run: (a) => a.deleteGroup('g') },
  { key: 'group:rename', run: (a) => a.renameGroup('g', 'renamed_group') },
  { key: 'group:update-color', run: (a) => a.updateGroupColor('g', 'blue') },
  { key: 'group:update-tables', run: (a) => a.updateGroupTables('g', ['b'], ['a']) },
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
  useCanvasStore.getState().initYDoc(doc);
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
  const commands: string[] = [];
  let dispatching = false;
  let updates = 0;
  const unsubscribe = useCanvasStore.subscribe(() => {
    assert.ok(dispatching, '문서 명령 밖에서 스토어를 변경하면 안 된다');
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
      if (mode !== 'applied') return mode === 'rejected' ? 'rejected' : 'unavailable';
      dispatching = true;
      try {
        const mutation = policy.toMutation(command, { origin: { source: 'local' } });
        return applier.apply(mutation).applied ? 'applied' : 'rejected';
      } finally {
        dispatching = false;
      }
    },
    emitCommandWithResult: () => assert.fail('예상하지 않은 결과 명령'),
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
  let actions!: DiagramErdCrudActions;
  function Probe() {
    actions = useDiagramErdCrudActions();
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
  return { doc, actions, commands, i18n, unsubscribe, updates: () => updates };
}

for (const item of cases) {
  for (const language of ['ko', 'en']) {
    for (const mode of ['no-session', 'disabled', 'missing-adapter', 'unavailable', 'rejected']) {
      test(`${item.key}: ${language} ${mode} rejects with no store/doc write and one toast`, async (t) => {
        const warning = t.mock.method(toast, 'warning', () => 'warning');
        const h = await harness(language, mode);
        try {
          const beforeDoc = Y.encodeStateAsUpdate(h.doc);
          const beforeStore = useCanvasStore.getState();
          assert.equal(item.run(h.actions), 'rejected');
          assert.equal(useCanvasStore.getState(), beforeStore);
          assert.deepEqual(Y.encodeStateAsUpdate(h.doc), beforeDoc);
          assert.equal(h.updates(), 0);
          assert.deepEqual(
            h.commands,
            ['unavailable', 'rejected'].includes(mode) ? [item.key] : [],
          );
          assert.ok(h.i18n.exists('diagram.toast.commandRejected'));
          assert.equal(warning.mock.callCount(), 1);
          assert.equal(
            warning.mock.calls[0].arguments[0],
            h.i18n.t('diagram.toast.commandRejected'),
          );
        } finally {
          h.unsubscribe();
          useCanvasStore.getState().destroyYDoc();
          h.doc.destroy();
        }
      });
    }
  }
  test(`${item.key}: success writes only inside one document command`, async (t) => {
    const warning = t.mock.method(toast, 'warning', () => 'warning');
    const h = await harness('ko', 'applied');
    try {
      const beforeDoc = Y.encodeStateAsUpdate(h.doc);
      const beforeStore = useCanvasStore.getState();
      assert.equal(item.run(h.actions), 'applied');
      assert.deepEqual(h.commands, [item.key]);
      assert.notDeepEqual(Y.encodeStateAsUpdate(h.doc), beforeDoc);
      assert.notEqual(useCanvasStore.getState(), beforeStore);
      assert.equal(h.updates(), 1);
      assert.equal(warning.mock.callCount(), 0);
    } finally {
      h.unsubscribe();
      useCanvasStore.getState().destroyYDoc();
      h.doc.destroy();
    }
  });
}
