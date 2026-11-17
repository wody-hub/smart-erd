import * as recoverySession from '../../src/lib/code-block-recovery-session.js';
import {
  CodeBlockRecoveryJournal,
  type RecoveryStorage,
} from '../../src/lib/code-block-recovery-journal.js';
import * as blockNames from '../../src/lib/code-block-names.js';
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
async function mounted(size = 2, storage?: RecoveryStorage) {
  const { Selection } = await import(
    pathToFileURL(resolve('node_modules/monaco-editor/esm/vs/editor/common/core/selection.js')).href
  );
  const doc: ProjectionSnapshot = {
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: Array.from({ length: size }, (_, i) =>
      i === 0 ? 'a' : i === 1 ? 'b' : `t${String(i).padStart(4, '0')}`,
    ).map((id) => ({
      id,
      data: {
        label: id,
        columns: Array.from({ length: size > 2 ? 20 : 1 }, (_, j) => ({
          id: j === 0 ? `${id}-col` : `${id}-col-${j}`,
          name: j === 0 ? `value_${id}` : `value_${id}_${j}`,
          type: 'INT',
          nullable: true,
        })),
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
  const editingControllers: CodeBlockEditingController[] = [];
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
  let loggedIn = true;
  const journal =
    storage &&
    new CodeBlockRecoveryJournal(storage, 'account', 'diagram', `tab-${Math.random()}`, () => 1000);
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/use-diagram-code-block-editing.ts',
    {
      'use-diagram-erd-code-block-actions': {
        useDiagramErdCodeBlockActions: () => ({ commitCodeBlock }),
      },
      'use-diagram-command-feedback': { useDiagramRejectedCommandToast: () => () => {} },
      'code-block-commit': { bindBlockIds },
      'code-block-recovery-session': {
        ...recoverySession,
        browserRecoveryJournal: () => journal,
        recoveryAccountActive: () => loggedIn,
      },
      'code-block-recovery-journal': { RECOVERY_LIMITS: { heartbeatMs: 5000 } },
      'code-block-names': blockNames,
      'diagram-code-block-editing': {
        CodeBlockEditingController: class extends CodeBlockEditingController {
          /** 입력 경로가 전체 상태를 순회하는지 관측할 컨트롤러를 보관한다. */
          constructor(options: ConstructorParameters<typeof CodeBlockEditingController>[0]) {
            super(options);
            editingControllers.push(this);
          }
        },
      },
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
      Date: { now: () => 1000 },
      document: {
        visibilityState: 'hidden',
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
    accountId: 'account',
    diagramId: 'diagram',
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
  const dom = new EventTarget();
  const codeEditor = {
    getDomNode: () => dom,
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
    journal,
    logout: () => {
      loggedIn = false;
      if (storage) CodeBlockRecoveryJournal.clearAccount(storage, 'account');
    },
    controller: () => editingControllers[0],
    dom,
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
    await h.commands.get('erd-unified-editing.undo')!.run({} as editor.ICodeEditor);
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
    await h.commands.get('erd-unified-editing.undo')!.run({} as editor.ICodeEditor);
    assert.equal(h.model.getValue(), original);
    await h.commands.get('erd-unified-editing.redo')!.run({} as editor.ICodeEditor);
    assert.equal(h.model.getValue(), '');
    h.doc.nodes[0].data.label = 'remote_a';
    h.emit();
    assert.equal(h.model.getValue(), '');
    await h.commands.get('erd-unified-editing.undo')!.run({} as editor.ICodeEditor);
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
    await h.commands.get('erd-unified-editing.undo')!.run({} as editor.ICodeEditor);
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

test('hook: real TextModel native undo after shifted remote patch routes to document history', async () => {
  const h = await mounted();
  try {
    h.edit('value_b ::INT', 'value_b ::TEXT');
    h.tick(800);
    h.emit([h.commits[0].commitId]);
    h.doc.nodes[0].data.label = 'a_much_longer_remote_name';
    h.emit();
    const text = h.model.getValue();
    await h.model.undo();
    assert.equal(h.model.getValue(), text);
    assert.equal(h.undoCount(), 1);
  } finally {
    h.close();
  }
});
for (const inputType of ['historyUndo', 'historyRedo'])
  test(`hook: beforeinput ${inputType} is prevented and uses local router`, async () => {
    const h = await mounted();
    try {
      h.edit('value_b ::INT', 'value_b ::TEXT');
      if (inputType === 'historyRedo') await h.model.undo();
      const event = new Event('beforeinput', { cancelable: true });
      Object.defineProperty(event, 'inputType', { value: inputType });
      h.dom.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
      assert.match(
        h.model.getValue(),
        inputType === 'historyUndo' ? /value_b ::INT/ : /value_b ::TEXT/,
      );
      assert.equal(h.undoCount(), 0);
    } finally {
      h.close();
    }
  });
for (const [key, shiftKey, metaKey] of [
  ['z', false, false],
  ['z', false, true],
  ['z', true, false],
  ['z', true, true],
  ['y', false, false],
] as const)
  test(`hook: keyboard ${metaKey ? 'Cmd' : 'Ctrl'} ${shiftKey ? 'Shift' : ''} ${key}`, async () => {
    const h = await mounted();
    try {
      h.edit('value_b ::INT', 'value_b ::TEXT');
      const redo = shiftKey || key === 'y';
      if (redo) await h.model.undo();
      const event = new Event('keydown', { cancelable: true });
      Object.assign(event, { key, shiftKey, metaKey, ctrlKey: !metaKey, altKey: false });
      h.dom.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
      assert.match(h.model.getValue(), redo ? /value_b ::TEXT/ : /value_b ::INT/);
    } finally {
      h.close();
    }
  });
test('hook: context menu actions share the history router', async () => {
  const h = await mounted();
  try {
    h.edit('value_b ::INT', 'value_b ::TEXT');
    const undo = h.commands.get('erd-unified-editing.undo')!;
    assert.equal(undo.contextMenuGroupId, '1_modification');
    await undo.run({} as editor.ICodeEditor);
    assert.match(h.model.getValue(), /value_b ::INT/);
    await h.commands.get('erd-unified-editing.redo')!.run({} as editor.ICodeEditor);
    assert.match(h.model.getValue(), /value_b ::TEXT/);
  } finally {
    h.close();
  }
});

test('hook: merged duplicate physical names mark all affected column lines', async () => {
  const h = await mounted();
  try {
    h.doc.nodes[0].data.columns.push({
      id: 'second',
      name: 'value_a',
      type: 'TEXT',
      nullable: true,
    });
    h.emit();
    assert.equal(h.markers().length, 2);
    assert.ok(h.markers().every((marker) => marker.message.includes('duplicateColumnNames')));
    assert.equal(new Set(h.markers().map((marker) => marker.startLineNumber)).size, 2);
  } finally {
    h.close();
  }
});

test('hook: ordinary keystroke reads no full text and only the changed block columns', async () => {
  const h = await mounted(200);
  try {
    let fullReads = 0,
      rangeReads = 0,
      fullStateReads = 0;
    const values = h.controller().blocks.values.bind(h.controller().blocks);
    h.controller().blocks.values = () => {
      fullStateReads++;
      return values();
    };
    const getValue = h.model.getValue.bind(h.model);
    const getRange = h.model.getValueInRange.bind(h.model);
    h.model.getValue = (...args) => {
      fullReads++;
      return getValue(...args);
    };
    h.model.getValueInRange = (...args) => {
      rangeReads++;
      return getRange(...args);
    };
    h.edit('value_b ::INT', 'value_b ::TEXT');
    assert.equal(fullReads, 1); // 입력을 만드는 테스트 코드의 getValue 한 번뿐이다.
    assert.equal(fullStateReads, 0);
    assert.equal(rangeReads, 2); // Monaco의 텍스트 undo 기록용 부분 읽기 한 번을 포함한다.
  } finally {
    h.close();
  }
});
for (const size of [200, 500])
  test(`hook: complete node keystroke handler S${size} p95 <= 2ms`, async (t) => {
    const h = await mounted(size);
    try {
      const at = h.model.getValue().indexOf('value_b ::INT') + 'value_b ::IN'.length;
      const start = h.model.getPositionAt(at),
        end = h.model.getPositionAt(at + 1);
      const range = {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      };
      const samples: number[] = [];
      for (let i = 0; i < 280; i++) {
        const begin = performance.now();
        h.model.applyEdits([{ range, text: i % 2 ? 'T' : 'X' }]);
        if (i >= 30) samples.push(performance.now() - begin);
      }
      samples.sort((a, b) => a - b);
      t.diagnostic(
        `complete hook S${size} p50=${samples[125].toFixed(3)}ms p95=${samples[237].toFixed(3)}ms`,
      );
      assert.ok(samples[237] <= 2, `p95=${samples[237]}ms`);
    } finally {
      h.close();
    }
  });

test('hook: structural undo after incremental edits restores updated text and column ID ranges', async () => {
  const h = await mounted();
  try {
    h.edit('value_b ::INT', 'value_b ::BIGINT');
    const text = h.model.getValue();
    h.model.applyEdits([{ range: h.model.getFullModelRange(), text: '' }]);
    await h.model.undo();
    assert.equal(h.model.getValue(), text);
    assert.equal(h.commits.length, 0);
    const columns = h.model
      .getAllDecorations()
      .filter((item) => item.options.className?.startsWith('erd-projection-column-'));
    assert.ok(
      columns.some((item) => h.model.getValueInRange(item.range).includes('value_b ::BIGINT')),
    );
  } finally {
    h.close();
  }
});

test('hook: multiple edits inside one block avoid full text collection', async () => {
  const h = await mounted();
  try {
    const text = h.model.getValue();
    const edits = [
      ['value_b', 'renamed_b'],
      ['INT', 'BIGINT'],
    ].map(([from, to]) => {
      const at =
        from === 'INT' ? text.indexOf('::INT', text.indexOf('value_b')) + 2 : text.indexOf(from);
      const start = h.model.getPositionAt(at),
        end = h.model.getPositionAt(at + from.length);
      return {
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        text: to,
      };
    });
    let reads = 0;
    const getValue = h.model.getValue.bind(h.model);
    h.model.getValue = (...args) => {
      reads++;
      return getValue(...args);
    };
    h.model.applyEdits(edits);
    assert.equal(reads, 0);
    h.tick(800);
    assert.equal(h.commits.length, 1);
    assert.equal(h.doc.nodes[1].data.columns[0].name, 'renamed_b');
    assert.equal(h.doc.nodes[1].data.columns[0].type, 'BIGINT');
  } finally {
    h.close();
  }
});

/** 저널 통합 테스트에 쓰는 localStorage 호환 저장소. */
function recoveryStorage(): RecoveryStorage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

test('hook recovery: debounce, pagehide flush, reload banner, discard and no document writes', async () => {
  const storage = recoveryStorage();
  const first = await mounted(2, storage);
  first.edit('value_b ::INT', 'value_b ::?');
  first.tick(499);
  assert.equal(first.journal!.read().length, 0);
  first.tick(1);
  assert.equal(first.journal!.read().length, 1);
  first.edit('value_b ::?', 'value_b ::??');
  first.event('pagehide');
  assert.match(first.journal!.read()[0].text, /::\?\?/);
  assert.equal(first.commits.length, 0);
  first.close();
  const second = await mounted(2, storage);
  try {
    assert.match(second.model.getValue(), /value_b ::\?\?/);
    assert.equal(second.state().recoveredCount, 1);
    second.tick(6000);
    assert.equal(second.commits.length, 0);
    second.state().discardRecovered();
    assert.equal(second.state().recoveredCount, 0);
    assert.match(second.model.getValue(), /value_b ::INT/);
    assert.equal(second.journal!.read().length, 0);
  } finally {
    second.close();
  }
});

test('hook recovery: hidden/unmount flush; success and revert delete journal; logout cannot repopulate', async () => {
  const storage = recoveryStorage();
  const h = await mounted(2, storage);
  h.edit('value_b ::INT', 'value_b ::TEXT');
  h.event('visibilitychange');
  assert.equal(h.journal!.read().length, 1);
  h.tick(800);
  assert.equal(h.commits.length, 1);
  assert.equal(h.journal!.read().length, 0);
  h.edit('value_a ::INT', 'value_a ::TEXT');
  h.tick(500);
  assert.equal(h.journal!.read().length, 1);
  h.edit('value_a ::TEXT', 'value_a ::INT');
  assert.equal(h.journal!.read().length, 0);
  h.edit('value_a ::INT', 'value_a ::?');
  h.close();
  assert.match(h.journal!.read()[0].text, /::\?/);
  const next = await mounted(2, storage);
  next.edit('value_a ::?', 'value_a ::??');
  next.logout();
  next.event('pagehide');
  next.close();
  assert.equal(storage.length, 0);
});

test('hook recovery: second tab skips live dirty owner and cannot duplicate its commit', async () => {
  const storage = recoveryStorage();
  const first = await mounted(2, storage);
  first.edit('value_b ::INT', 'value_b ::TEXT');
  first.tick(500);
  const second = await mounted(2, storage);
  try {
    assert.equal(second.state().recoveredCount, 0);
    assert.match(second.model.getValue(), /value_b ::INT/);
    first.tick(300);
    second.tick(1000);
    assert.equal(first.commits.length, 1);
    assert.equal(second.commits.length, 0);
  } finally {
    first.close();
    second.close();
  }
});

test('hook recovery: restored valid edit uses normal idle flow and clears banner on success', async () => {
  const storage = recoveryStorage();
  const first = await mounted(2, storage);
  first.edit('value_b ::INT', 'value_b ::TEXT');
  first.event('pagehide');
  first.close();
  const second = await mounted(2, storage);
  try {
    assert.equal(second.state().recoveredCount, 1);
    assert.equal(second.commits.length, 0);
    second.tick(799);
    assert.equal(second.commits.length, 0);
    second.tick(1);
    assert.equal(second.commits.length, 1);
    assert.equal(second.state().recoveredCount, 0);
    assert.equal(second.journal!.read().length, 0);
  } finally {
    second.close();
  }
});

test('hook recovery: BFCache release reacquires ownership before resuming normal commit', async () => {
  const h = await mounted(2, recoveryStorage());
  try {
    h.edit('value_b ::INT', 'value_b ::TEXT');
    h.event('pagehide');
    h.tick(6000);
    assert.equal(h.commits.length, 0);
    h.event('pageshow');
    h.tick(800);
    assert.equal(h.commits.length, 1);
    assert.equal(h.journal!.read().length, 0);
  } finally {
    h.close();
  }
});
