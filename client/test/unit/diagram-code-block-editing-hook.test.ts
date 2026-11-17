import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { TFunction } from 'i18next';
import type { useDiagramCodeBlockEditing } from '../../src/collaboration/channel/diagram/use-diagram-code-block-editing.js';
import type { DiagramCodeProjectionPatch } from '../../src/collaboration/channel/diagram/diagram-code-projection-state.js';
import { bindBlockIds } from '../../src/lib/code-block-commit.js';
import { CodeBlockEditingController } from '../../src/lib/diagram-code-block-editing.js';
import * as projectionModel from '../../src/lib/dsl-live-projection-model.js';
import * as editingModel from '../../src/lib/dsl-editable-projection-model.js';
import {
  generateProjection,
  diffProjection,
  type ProjectionSnapshot,
} from '../../src/lib/dsl-block-projection.js';
import type { CodeBlockCommit } from '../../src/lib/code-block-commit-contract.js';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';
import { createProjectionMonacoModel } from '../helpers/projection-monaco-model.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** 실제 TextModel 위에 에디터 UI 포트와 가상 타이머를 연결한다. */
async function mounted() {
  const { Selection } = await import(
    pathToFileURL(resolve('node_modules/monaco-editor/esm/vs/editor/common/core/selection.js')).href
  );
  const doc: ProjectionSnapshot = {
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: ['a', 'b'].map((id) => ({
      id,
      data: {
        label: id,
        columns: [{ id: `${id}-col`, name: `value_${id}`, type: 'INT', nullable: true }],
      },
    })),
  };
  let snapshot = {
    ...generateProjection(doc),
    revision: 1,
    unsupportedNotices: 0,
    status: 'ready' as const,
  };
  let ready = true,
    time = 0,
    seq = 0,
    documentUndo = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const listeners = new Set<(event: DiagramCodeProjectionPatch) => void>();
  const callbacks = new Map<string, () => void>();
  const commands = new Map<string, editor.IActionDescriptor>();
  const commits: CodeBlockCommit[] = [];
  let markers: editor.IMarkerData[] = [];
  const commitCodeBlock = (commit: CodeBlockCommit) => {
    commits.push(commit);
    for (const patch of commit.patches) {
      const node = doc.nodes.find((node) => node.id === patch.tableId)!;
      Object.assign(
        patch.target === 'table'
          ? node.data
          : node.data.columns.find((col) => col.id === patch.columnId)!,
        { [patch.field]: patch.nextValue },
      );
    }
    return {
      status: 'applied' as const,
      commitId: commit.commitId,
      noop: false,
      changedFields: commit.patches.length,
    };
  };
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/use-diagram-code-block-editing.ts',
    {
      'use-diagram-erd-code-block-actions': {
        useDiagramErdCodeBlockActions: () => ({ commitCodeBlock }),
      },
      'use-diagram-command-feedback': { useDiagramRejectedCommandToast: () => () => {} },
      'code-block-commit': { bindBlockIds },
      'diagram-code-block-editing': { CodeBlockEditingController },
      'dsl-live-projection-model': projectionModel,
      'dsl-editable-projection-model': editingModel,
      'dsl-block-projection': { diffProjection },
      'erd-performance-probe': {
        probeExposeProjectionEditor() {},
        probeProjectionPatchApplied() {},
        probeCodeBlockCommitPhase() {},
        probeCounter() {},
      },
      useCanvasStore: {
        __esModule: true,
        default: {
          getState: () => ({
            undo: () => {
              documentUndo++;
            },
            redo() {},
          }),
        },
      },
    },
    {
      window: {
        addEventListener: (name: string, fn: () => void) => callbacks.set(name, fn),
        removeEventListener: (name: string) => callbacks.delete(name),
      },
      performance: { now: () => time },
      crypto: { randomUUID: () => `commit-${++seq}` },
      setTimeout: (run: () => void, delay: number) => {
        const id = ++seq;
        timers.set(id, { at: time + delay, run });
        return id;
      },
      clearTimeout: (id: number) => timers.delete(id),
    },
  );
  const hook = h.exports.useDiagramCodeBlockEditing as typeof useDiagramCodeBlockEditing;
  const input = {
    projection: {
      ...snapshot,
      getSnapshot: () => snapshot,
      subscribePatches: (fn: (event: DiagramCodeProjectionPatch) => void) => {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    },
    dictionary: { version: 1, fingerprint: 'd', dictionary: doc.dictionary },
    ready,
    isReady: () => ready,
    t: ((key: string) => key) as TFunction,
  };
  let result = h.render(() => hook(input));
  h.runEffects();
  const model = await createProjectionMonacoModel('', true);
  let selection = new Selection(1, 1, 1, 1),
    scrollTop = 0,
    scrollLeft = 0;
  const on = (name: string, fn: () => void) => {
    callbacks.set(name, fn);
    return {
      dispose: () => {
        callbacks.delete(name);
      },
    };
  };
  const codeEditor = {
    getModel: () => model,
    getPosition: () => selection.getPosition(),
    getSelection: () => selection,
    setSelection: (next: typeof selection) => {
      selection = next;
      callbacks.get('cursor')?.();
    },
    getVisibleRanges: () => [model.getFullModelRange()],
    getScrollTop: () => scrollTop,
    getScrollLeft: () => scrollLeft,
    getTopForLineNumber: (line: number) => (line - 1) * 20,
    setScrollPosition: (next: { scrollTop: number; scrollLeft: number }) => {
      scrollTop = next.scrollTop;
      scrollLeft = next.scrollLeft;
    },
    createDecorationsCollection: (items: editor.IModelDeltaDecoration[]) => {
      let ids = model.deltaDecorations([], items);
      return {
        getRange: (index: number) => model.getDecorationRange(ids[index]),
        set: (items: editor.IModelDeltaDecoration[]) => {
          ids = model.deltaDecorations(ids, items);
        },
        clear: () => {
          ids = model.deltaDecorations(ids, []);
        },
      };
    },
    onDidChangeCursorPosition: (fn: () => void) => on('cursor', fn),
    onDidBlurEditorText: (fn: () => void) => on('blur', fn),
    onDidCompositionStart: (fn: () => void) => on('start', fn),
    onDidCompositionEnd: (fn: () => void) => on('end', fn),
    addAction: (action: editor.IActionDescriptor) => {
      commands.set(action.id, action);
      return {
        dispose: () => {
          commands.delete(action.id);
        },
      };
    },
  } as unknown as Parameters<OnMount>[0];
  const monaco = {
    Selection,
    editor: {
      TrackedRangeStickiness: { AlwaysGrowsWhenTypingAtEdges: 0 },
      ScrollType: { Immediate: 1 },
      setModelMarkers: (_model: unknown, _owner: unknown, items: editor.IMarkerData[]) => {
        markers = items;
      },
    },
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    KeyCode: { KeyZ: 56, KeyY: 55 },
    MarkerSeverity: { Error: 8 },
  } as unknown as Parameters<OnMount>[1];
  result.onMount(codeEditor, monaco);
  return {
    model,
    doc,
    commits,
    listeners,
    commands,
    markers: () => markers,
    selection: () => selection,
    undoCount: () => documentUndo,
    state: () => {
      result = h.render(() => hook(input));
      return result;
    },
    event: (name: string) => callbacks.get(name)?.(),
    ready: (value: boolean) => {
      ready = value;
      input.ready = value;
      result = h.render(() => hook(input));
      h.runEffects();
    },
    edit: (from: string, to: string) => {
      const at = model.getValue().indexOf(from);
      assert.ok(at >= 0);
      const a = model.getPositionAt(at),
        b = model.getPositionAt(at + from.length);
      codeEditor.setSelection(new Selection(a.lineNumber, a.column, b.lineNumber, b.column));
      model.pushEditOperations(
        null,
        [
          {
            range: {
              startLineNumber: a.lineNumber,
              startColumn: a.column,
              endLineNumber: b.lineNumber,
              endColumn: b.column,
            },
            text: to,
          },
        ],
        () => null,
      );
      const end = model.getPositionAt(at + to.length);
      codeEditor.setSelection(
        new Selection(end.lineNumber, end.column, end.lineNumber, end.column),
      );
      model.pushStackElement();
    },
    emit: (ids: string[] = []) => {
      const next = {
        ...generateProjection({ ...doc, revision: snapshot.revision + 1 }),
        revision: snapshot.revision + 1,
        status: 'ready' as const,
        unsupportedNotices: 0,
      };
      const batch = {
        ...diffProjection(snapshot, next),
        baseRevision: snapshot.revision,
        nextRevision: next.revision,
        blockMetadata: next.blocks,
        dictionaryVersion: 1,
        dictionaryFingerprint: 'd',
        invalidatedTableIds: [],
        fullRevalidation: false,
        fullResync: false,
        commitIds: ids,
      };
      snapshot = next;
      listeners.forEach((fn) => fn({ batch, snapshot: next, receivedAt: time }));
    },
    tick: (ms: number) => {
      const end = time + ms;
      for (;;) {
        const entry = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry || entry[1].at > end) break;
        time = entry[1].at;
        timers.delete(entry[0]);
        entry[1].run();
      }
      time = end;
    },
    close: () => {
      h.cleanup();
      model.dispose();
    },
  };
}

test('hook: typing uses reducer timers; own echo causes zero model edits/cursor changes; clean undo uses document', async () => {
  const h = await mounted();
  try {
    h.edit('value_a ::INT', 'value_a ::TEXT');
    h.tick(799);
    assert.equal(h.commits.length, 0);
    h.tick(1);
    assert.equal(h.commits.length, 1);
    const before = h.model.getVersionId(),
      selection = h.selection();
    h.emit([h.commits[0].commitId]);
    assert.equal(h.model.getVersionId(), before);
    assert.deepEqual(h.selection(), selection);
    await h.commands.get('undo')!.run({} as editor.ICodeEditor);
    assert.equal(h.undoCount(), 1);
    assert.equal(
      h.state().blocks.find((block) => block.base.tableId === 'a')?.state.status,
      'CLEAN',
    );
  } finally {
    h.close();
  }
  assert.equal(h.listeners.size, 0);
  assert.equal(h.commands.size, 0);
});
test('hook: dirty remote change keeps text/cursor and patches a clean preceding block with shifted decorations', async () => {
  const h = await mounted();
  try {
    h.edit('value_b ::INT', 'value_b ::TEXT');
    h.event('start');
    const selection = h.selection();
    h.doc.nodes[1].data.label = 'remote_b';
    h.emit();
    assert.match(h.model.getValue(), /b \{/);
    assert.deepEqual(h.selection(), selection);
    assert.equal(h.state().blocks.find((block) => block.base.tableId === 'b')?.remotePending, true);
    h.doc.nodes[0].data.label = 'long_a';
    h.emit();
    assert.match(h.model.getValue(), /long_a \{/);
    assert.match(h.model.getValue(), /value_b ::TEXT/);
    assert.deepEqual(h.selection(), selection);
    h.tick(6000);
    assert.equal(h.commits.length, 0);
    h.ready(false);
    assert.equal(
      h.state().blocks.find((block) => block.base.tableId === 'b')?.state.status,
      'BLOCKED',
    );
  } finally {
    h.close();
  }
});
test('hook: multiline structural replacement keeps text and sets inline diagnostics', async () => {
  const h = await mounted();
  try {
    h.edit('  value_b ::INT\n', '');
    h.tick(200);
    assert.equal(h.commits.length, 0);
    assert.ok(h.markers().length);
    assert.equal(
      h.state().blocks.find((block) => block.base.tableId === 'b')?.state.status,
      'UNSUPPORTED',
    );
  } finally {
    h.close();
  }
});

test('hook: committing a dirty block settles pending remote-only fields before the echo without extra commits', async () => {
  const h = await mounted();
  try {
    h.edit('value_b ::INT', 'value_b ::TEXT');
    h.doc.nodes[1].data.label = 'remote_b';
    h.emit();
    assert.match(h.model.getValue(), /b \{/);
    h.tick(800);
    assert.match(h.model.getValue(), /remote_b \{/);
    assert.match(h.model.getValue(), /value_b ::TEXT/);
    assert.equal(h.commits.length, 1);
    const version = h.model.getVersionId();
    h.emit([h.commits[0].commitId]);
    assert.equal(h.model.getVersionId(), version);
    h.tick(6000);
    assert.equal(h.commits.length, 1);
  } finally {
    h.close();
  }
});

test('hook: multi-block deletion has local undo/redo with ID restoration and defers remote patches safely', async () => {
  const h = await mounted();
  try {
    const original = h.model.getValue();
    h.edit(original, '');
    h.tick(6000);
    assert.equal(h.commits.length, 0);
    assert.ok(h.markers().length);
    assert.equal(h.model.getValue(), '');
    await h.commands.get('undo')!.run({} as editor.ICodeEditor);
    assert.equal(h.model.getValue(), original);
    await h.commands.get('redo')!.run({} as editor.ICodeEditor);
    assert.equal(h.model.getValue(), '');
    h.doc.nodes[0].data.label = 'remote_a';
    h.emit();
    assert.equal(h.model.getValue(), '');
    await h.commands.get('undo')!.run({} as editor.ICodeEditor);
    assert.match(h.model.getValue(), /remote_a \{/);
    assert.match(h.model.getValue(), /value_b ::INT/);
    h.edit('value_b ::INT', 'value_b ::TEXT');
    h.tick(800);
    assert.equal(h.commits.length, 1);
    assert.equal(h.commits[0].tableId, 'b');
    assert.equal(h.commits[0].patches[0].target, 'column');
    const patch = h.commits[0].patches[0];
    if (patch.target === 'column') assert.equal(patch.columnId, 'b-col');
  } finally {
    h.close();
  }
});

test('hook: undo of a deleted column line restores its ID decoration range', async () => {
  const h = await mounted();
  try {
    h.edit('  value_b ::INT\n', '');
    h.tick(200);
    await h.commands.get('undo')!.run({} as editor.ICodeEditor);
    const columns = h.model
      .getAllDecorations()
      .filter((item) => item.options.className?.startsWith('erd-projection-column-'));
    assert.equal(
      columns.some((item) => h.model.getValueInRange(item.range).includes('value_b ::INT')),
      true,
    );
  } finally {
    h.close();
  }
});

test('hook: pagehide writes nothing and BFCache pageshow reparses retained text', async () => {
  const h = await mounted();
  try {
    h.edit('value_b ::INT', 'value_b ::TEXT');
    h.event('pagehide');
    h.tick(6000);
    assert.equal(h.commits.length, 0);
    assert.match(h.model.getValue(), /value_b ::TEXT/);
    assert.equal(
      h.state().blocks.find((block) => block.base.tableId === 'b')?.state.status,
      'BLOCKED',
    );
    h.event('pageshow');
    h.tick(800);
    assert.equal(h.commits.length, 1);
  } finally {
    h.close();
  }
});
