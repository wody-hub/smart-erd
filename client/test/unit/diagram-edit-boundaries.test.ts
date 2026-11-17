import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as Y from 'yjs';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';
import { writeSharedSchemaDraftSnapshot } from '../../src/lib/shared-schema-draft.js';
import { writeCodeModeSharedDraftTextSnapshot } from '../../src/lib/code-mode-shared-draft.js';

/** 실제 에디터 콜백을 추출해 Monaco/DOM 없이 실행한다. */
function editorCallback(
  name: string,
  bindings: Record<string, unknown>,
): (...args: unknown[]) => void {
  const source = readFileSync('src/components/erd/DslCodeEditorPanel.tsx', 'utf8');
  const file = ts.createSourceFile(
    'editor.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    )
      callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(callback, name);
  const js = ts.transpileModule(`(${callback.getText(file)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return runInNewContext(js, bindings);
}

for (const value of ['typed text', 'pasted\ntext']) {
  test(`stale disconnected editor input rejects ${JSON.stringify(value)} without edits`, () => {
    const doc = new Y.Doc();
    let ready = true;
    let edits = 0;
    const isCodeEditable = editorCallback('isCodeEditable', {
      canEditRef: { current: true },
      mutationSessionRef: {
        current: {
          get ready() {
            return ready;
          },
        },
      },
      persistDraft: true,
    });
    const onChange = editorCallback('guardedOnChange', {
      isCodeEditable,
      shouldIgnoreChange: () => false,
      markLocalEditStarted: () => edits++,
      markFinalizationDirty: () => edits++,
      confirmedBlankDraftRef: {},
      handleUserCodeChange: (text: string) => doc.getMap('draft').set('text', text),
    });
    ready = false;
    let updates = 0;
    doc.on('update', () => updates++);
    onChange(value);
    assert.equal(edits, 0);
    assert.equal(updates, 0);
    doc.destroy();
  });
}

test('scheduled and unmount draft flushes keep local text without shared Y.Doc updates', () => {
  const doc = new Y.Doc();
  let ready = true;
  let localText = '';
  let updates = 0;
  doc.on('update', () => updates++);
  const bindings = {
    persistDraft: true,
    draftHydrated: true,
    ydoc: doc,
    isCodeEditable: () => ready,
    shouldSkipGeneratedFallbackSharedDraftWrite: () => false,
    sharedSchemaDraftSyncTimerRef: { current: null },
    buildCurrentSharedSchemaDraftSnapshot: () => ({ tables: [], relations: [], positions: {} }),
    writeSharedSchemaDraftSnapshot,
    onScheduleCodeModeSnapshotPersist: () => {},
    SHARED_SCHEMA_DRAFT_ORIGIN: 'test',
    hasPendingDraftChanges: true,
    readCurrentDslText: () => 'locally typed draft',
    pendingHydratedTextRef: { current: null },
    pendingDraftRecordRef: { current: null },
    draftBaselineRevisionRef: { current: '1' },
    previewPositionOverrides: {},
    confirmedBlankDraftRef: { current: false },
    writeCodeModeSharedDraftTextSnapshot,
    persistDraftRecordImmediately: (record: { text: string }) => {
      localText = record.text;
    },
  };
  const sharedFlush = editorCallback('flushSharedSchemaDraftImmediately', bindings);
  const cleanupFlush = editorCallback('flushPendingDraftImmediately', {
    ...bindings,
    flushSharedSchemaDraftImmediately: sharedFlush,
  });
  ready = false;
  sharedFlush();
  cleanupFlush();
  assert.equal(updates, 0);
  assert.equal(localText, 'locally typed draft');
  doc.destroy();
});

test('VIEWER and unready reconciliation skips writes/toasts and retries the same revision when ready', () => {
  let ready = true;
  let reconciles = 0;
  let toasts = 0;
  const h = sourceHookHarness('src/hooks/useDiagramDictionaryReconciliation.ts', {
    'document-mutation-session': {
      useDocumentMutationSession: () => ({
        get ready() {
          return ready;
        },
      }),
    },
    ErdDictionaryContext: {
      useErdDictionary: () => ({
        setId: 'dictionary',
        isDictionaryReady: true,
        dictionaryRevision: '1',
      }),
    },
    'use-diagram-erd-read-snapshot': { useDiagramErdNodesSnapshot: () => ({ currentNodes: [{}] }) },
    'use-diagram-dictionary-reconciliation-actions': {
      useDiagramDictionaryReconciliationActions: () => ({
        reconcile: () => {
          reconciles++;
          toasts++;
          return 'applied';
        },
      }),
    },
    'diagram-dictionary-reconciliation': {
      buildDiagramDictionaryReconciliationPlan: () => ({
        tableMetaUpdates: [{}],
        columnUpdates: [],
      }),
    },
  });
  const hook = h.exports.useDiagramDictionaryReconciliation as (params: unknown) => void;
  const render = (canEdit: boolean) => {
    h.render(() =>
      hook({ canEdit, diagramId: 'd', isPreviewMode: false, previewSyncStatus: 'live' }),
    );
    h.runEffects();
  };
  render(false);
  render(false);
  assert.equal(reconciles, 0);
  assert.equal(toasts, 0);
  ready = false;
  render(true);
  assert.equal(reconciles, 0);
  ready = true;
  render(true);
  assert.equal(reconciles, 1, '건너뛴 revision은 완료로 기록하지 않는다');
});

for (const action of ['undo', 'redo']) {
  test(`${action} rechecks dispatch readiness and uses the deduped rejection toast`, () => {
    const doc = new Y.Doc();
    const map = doc.getMap('tables');
    const manager = new Y.UndoManager(map);
    map.set('a', 'local');
    if (action === 'redo') manager.undo();
    const ids = new Set<string>();
    const feedback = sourceHookHarness(
      'src/collaboration/channel/diagram/use-diagram-command-feedback.ts',
      {
        'react-i18next': { useTranslation: () => ({ t: (key: string) => key }) },
        sonner: {
          toast: { warning: (_text: string, options: { id: string }) => ids.add(options.id) },
        },
      },
    );
    const notify = (feedback.exports.useDiagramRejectedCommandToast as () => () => void)();
    const h = sourceHookHarness('src/stores/canvas/canvasSyncActions.ts', {});
    const create = h.exports.createCanvasSyncActions as (
      ...args: unknown[]
    ) => Record<string, (ready: () => boolean, notify: () => void) => void>;
    const actions = create(
      () => {},
      () => ({ internal: { undoManager: manager } }),
    );
    let ready = true;
    const staleHandler = () => actions[action](() => ready, notify);
    ready = false;
    let updates = 0;
    doc.on('update', () => updates++);
    staleHandler();
    staleHandler();
    assert.equal(updates, 0);
    assert.deepEqual([...ids], ['diagram-command-rejected']);
    ready = true;
    staleHandler();
    assert.equal(updates, 1);
    manager.destroy();
    doc.destroy();
  });
}
