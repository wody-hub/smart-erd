import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectionMonacoModel } from '../helpers/projection-monaco-model.js';
import { generateProjection, diffProjection } from '../../src/lib/dsl-block-projection.js';
import {
  applyLiveProjectionBatch,
  createLiveProjectionDecorationUpdater,
  buildLiveProjectionDecorations,
  initializeLiveProjectionModel,
  type ProjectionModel,
} from '../../src/lib/dsl-live-projection-model.js';
import { countUnsupportedProjectionRelations } from '../../src/collaboration/channel/diagram/diagram-code-projection-state.js';

/** UTF-16 좌표와 실제 범위 편집을 구현하는 메모리 모델. */
function modelMock(defaultEol: '\n' | '\r\n' = '\n') {
  let text = '';
  let eol = defaultEol;
  let sets = 0;
  let edits = 0;
  const model: ProjectionModel = {
    setValue: (value) => {
      // Monaco는 setValue 텍스트를 모델 EOL로 정규화한다(Windows UA는 기본 CRLF).
      text = value.replace(/\r?\n/g, eol);
      sets++;
    },
    setEOL: (sequence) => {
      eol = sequence === 0 ? '\n' : '\r\n';
      text = text.replace(/\r?\n/g, eol);
    },
    getPositionAt: (offset) => {
      const lines = text.slice(0, offset).split(eol);
      return { lineNumber: lines.length, column: lines.at(-1)!.length + 1 };
    },
    getOffsetAt: (position) =>
      text
        .split(eol)
        .slice(0, position.lineNumber - 1)
        .reduce((sum, line) => sum + line.length + eol.length, 0) +
      position.column -
      1,
    applyEdits: (operations) => {
      edits++;
      const patches = operations.map((op) => ({
        start: model.getOffsetAt({
          lineNumber: op.range.startLineNumber,
          column: op.range.startColumn,
        }),
        end: model.getOffsetAt({ lineNumber: op.range.endLineNumber, column: op.range.endColumn }),
        text: op.text,
      }));
      for (const p of patches.sort((a, b) => b.start - a.start))
        text = text.slice(0, p.start) + p.text + text.slice(p.end);
    },
  };
  return { model, text: () => text, sets: () => sets, edits: () => edits };
}

/** 고정 ID를 가진 테이블 투영을 만든다. */
function projection(ids: string[], revision: number, extra = false) {
  return generateProjection({
    revision,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: ids.map((id) => ({
      id,
      data: {
        label: id,
        columns: [
          ...(extra && id === 'a' ? [{ id: 'new', name: 'new', type: 'INT' }] : []),
          { id: 'col', name: 'value', type: 'INT' },
        ],
      },
    })),
  });
}

test('selection endpoints and viewport follow entity offsets through edits above them', () => {
  const before = projection(['a', 'b'], 1);
  const next = projection(['a', 'b'], 2, true);
  const m = modelMock();
  initializeLiveProjectionModel(m.model, before.text);
  const column = before.blocks[1].columnRanges[0];
  const view = {
    anchor: column.start + 2,
    active: column.start + 6,
    top: column.start,
    pixelOffset: 7.5,
  };
  const result = applyLiveProjectionBatch(
    m.model,
    before,
    {
      ...diffProjection(before, next),
      baseRevision: 1,
      nextRevision: 2,
      blockMetadata: next.blocks,
    },
    view,
  );
  const target = next.blocks[1].columnRanges[0];
  assert.deepEqual(result, {
    anchor: target.start + 2,
    active: target.start + 6,
    top: target.start,
    pixelOffset: 7.5,
    relocatedTargets: 0,
  });
  assert.equal(m.text(), next.text);
  assert.equal(m.sets(), 1);
  assert.equal(m.edits(), 1);
});

test('deleted targets move to the nearest surviving block and are counted', () => {
  const before = projection(['a', 'b', 'c'], 1);
  const next = projection(['a', 'c'], 2);
  const m = modelMock();
  initializeLiveProjectionModel(m.model, before.text);
  const offset = before.blocks[1].columnRanges[0].start;
  const result = applyLiveProjectionBatch(
    m.model,
    before,
    {
      ...diffProjection(before, next),
      baseRevision: 1,
      nextRevision: 2,
      blockMetadata: next.blocks,
    },
    { anchor: offset, active: offset + 2, top: offset, pixelOffset: 3 },
  );
  assert.equal(result.relocatedTargets, 3);
  assert.ok(result.anchor <= next.blocks[0].tableRange.end);
  assert.equal(m.text(), next.text);
  assert.equal(m.sets(), 1);
});

test('multiple batches never reset the initialized model; stale revisions are rejected before edits', () => {
  const m = modelMock();
  let previous = projection(['a', 'b'], 1);
  initializeLiveProjectionModel(m.model, previous.text);
  for (let revision = 2; revision < 6; revision++) {
    const next = projection(['a', 'b'], revision, revision % 2 === 0);
    applyLiveProjectionBatch(
      m.model,
      previous,
      {
        ...diffProjection(previous, next),
        baseRevision: revision - 1,
        nextRevision: revision,
        blockMetadata: next.blocks,
      },
      { anchor: 0, active: 0, top: 0, pixelOffset: 0 },
    );
    previous = next;
  }
  assert.equal(m.sets(), 1);
  assert.equal(m.text(), previous.text);
  assert.throws(
    () =>
      applyLiveProjectionBatch(
        m.model,
        previous,
        { baseRevision: 0, nextRevision: 1, patches: [], blockMetadata: [] },
        { anchor: 0, active: 0, top: 0, pixelOffset: 0 },
      ),
    /revision/i,
  );
  assert.equal(m.edits(), 4);
});

test('omitted relation notices are deduplicated from the unit A sidecar', () => {
  const blocks = projection(['a', 'b'], 1).blocks;
  blocks[0].metadata.unrepresentedRelationIds = ['fk-1', 'fk-2'];
  blocks[1].metadata.unrepresentedRelationIds = ['fk-2', 'orphan'];
  assert.equal(countUnsupportedProjectionRelations(blocks), 3);
  assert.equal(countUnsupportedProjectionRelations([]), 0);
});

test('supported Monaco decorations carry stable table and column identities and exact ranges', () => {
  const before = projection(['a', 'b'], 1);
  const after = projection(['a', 'b'], 2, true);
  const decorations = buildLiveProjectionDecorations(before.blocks);
  assert.equal(decorations[0].options.className, 'erd-projection-table-61');
  assert.equal(decorations[1].options.className, 'erd-projection-column-61--63-6f-6c');
  assert.deepEqual(decorations[1].range, {
    startLineNumber: before.blocks[0].columnRanges[0].startLine,
    startColumn: before.blocks[0].columnRanges[0].startColumn,
    endLineNumber: before.blocks[0].columnRanges[0].endLine,
    endColumn: before.blocks[0].columnRanges[0].endColumn,
  });
  assert.equal(
    buildLiveProjectionDecorations(after.blocks).find(
      (item) => item.options.className === decorations[3].options.className,
    )?.options.stickiness,
    1,
  );
});

test('CRLF 기본 EOL 모델에서도 패치가 LF 기준 오프셋 그대로 정확히 적용된다', () => {
  const before = projection(['a', 'b'], 1);
  const after = projection(['a', 'b'], 2, true);
  const mock = modelMock('\r\n');
  initializeLiveProjectionModel(mock.model, before.text);
  assert.equal(mock.text(), before.text);
  const batch = {
    ...diffProjection(before, after),
    baseRevision: 1,
    nextRevision: 2,
    blockMetadata: after.blocks,
  };
  applyLiveProjectionBatch(mock.model, before, batch, {
    anchor: 0,
    active: 0,
    top: 0,
    pixelOffset: 0,
  });
  assert.equal(mock.text(), after.text);
});

for (const [oldName, newName] of [
  ['😀', '😁'],
  ['😀', '🨀'],
]) {
  test(`real Monaco applies ${oldName} -> ${newName} then another block exactly`, async () => {
    const make = (name: string, other: string, revision: number) =>
      generateProjection({
        revision,
        dictionary: { terms: [], domains: [] },
        edges: [],
        nodes: [name, other].map((label, i) => ({
          id: i ? 'b' : 'a',
          data: { label, columns: [] },
        })),
      });
    let previous = make(oldName, 'second', 1);
    const model = await createProjectionMonacoModel();
    initializeLiveProjectionModel(model, previous.text);
    for (const next of [make(newName, 'second', 2), make(newName, 'changed second', 3)]) {
      applyLiveProjectionBatch(
        model,
        previous,
        {
          ...diffProjection(previous, next),
          blockMetadata: next.blocks,
        },
        { anchor: 0, active: 0, top: 0, pixelOffset: 0 },
      );
      assert.equal(model.getValue(), next.text);
      previous = next;
    }
    model.dispose();
  });
}

test('separator cursor, selection endpoints and viewport survive empty and shifted batches', () => {
  const before = projection(['a', 'b', 'c'], 1);
  const mock = modelMock();
  initializeLiveProjectionModel(mock.model, before.text);
  const view = {
    anchor: before.blocks[0].tableRange.end,
    active: before.blocks[1].tableRange.end,
    top: before.blocks[0].tableRange.end,
    pixelOffset: 3.5,
  };
  const empty = {
    ...diffProjection(before, { ...before, revision: 2 }),
    blockMetadata: before.blocks,
  };
  assert.deepEqual(applyLiveProjectionBatch(mock.model, before, empty, view), {
    ...view,
    relocatedTargets: 0,
  });
  const next = projection(['a', 'b', 'c'], 2, true);
  assert.deepEqual(
    applyLiveProjectionBatch(
      mock.model,
      before,
      { ...diffProjection(before, next), blockMetadata: next.blocks },
      view,
    ),
    {
      anchor: next.blocks[0].tableRange.end,
      active: next.blocks[1].tableRange.end,
      top: next.blocks[0].tableRange.end,
      pixelOffset: 3.5,
      relocatedTargets: 0,
    },
  );
});

test('block decorations do zero work for position/group-only batches and bounded work for a column rename', () => {
  let updates = 0;
  let decorations = 0;
  let cleared = 0;
  const updater = createLiveProjectionDecorationUpdater((items) => {
    updates++;
    decorations += items.length;
    return {
      set: (items) => {
        updates++;
        decorations += items.length;
        return [];
      },
      clear: () => {
        cleared++;
      },
    };
  });
  const make = (name: string, extra = false) =>
    generateProjection({
      revision: 1,
      dictionary: { terms: [], domains: [] },
      edges: [],
      nodes: Array.from({ length: 500 }, (_, i) => ({
        id: String(i).padStart(3, '0'),
        data: {
          label: `table${i}`,
          columns: [
            ...Array.from({ length: 20 }, (_, c) => ({
              id: `c${c}`,
              name: i === 0 && c === 0 ? name : `col${c}`,
              type: 'INT',
            })),
            ...(i === 0 && extra ? [{ id: 'new', name: 'new', type: 'INT' }] : []),
          ],
        },
      })),
    });
  const before = make('value');
  updater.update(before.blocks);
  assert.equal(decorations, 10500);
  updates = 0;
  decorations = 0;
  updater.update(structuredClone(before.blocks));
  assert.equal(updates, 0);
  assert.equal(decorations, 0);
  const next = make('longer value');
  updater.update(next.blocks);
  assert.equal(updates, 1);
  assert.equal(decorations, 21);
  // 행이 늘면 뒤 블록의 좌표도 명시적으로 갱신한다.
  const shifted = make('longer value', true);
  updater.update(shifted.blocks);
  assert.equal(updates, 501);
  updater.update(shifted.blocks.slice(1));
  assert.equal(cleared, 1);
  updater.clear();
  assert.equal(cleared, 500);
});

test('per-block decorations match real Monaco ranges after column edits, line shifts and deletion', async () => {
  const model = await createProjectionMonacoModel();
  const ids = new Set<string>();
  const updater = createLiveProjectionDecorationUpdater((items) => {
    let current = model.deltaDecorations([], items);
    current.forEach((id) => ids.add(id));
    return {
      set: (next) => {
        current.forEach((id) => ids.delete(id));
        current = model.deltaDecorations(current, [...next]);
        current.forEach((id) => ids.add(id));
        return current;
      },
      clear: () => {
        current.forEach((id) => ids.delete(id));
        model.deltaDecorations(current, []);
      },
    };
  });
  let previous = projection(['a', 'b', 'c'], 1);
  initializeLiveProjectionModel(model, previous.text);
  updater.update(previous.blocks);
  for (const next of [projection(['a', 'b', 'c'], 2, true), projection(['b', 'c'], 3)]) {
    applyLiveProjectionBatch(
      model,
      previous,
      { ...diffProjection(previous, next), blockMetadata: next.blocks },
      { anchor: 0, active: 0, top: 0, pixelOffset: 0 },
    );
    updater.update(next.blocks);
    const actual = [...ids].map((id) => JSON.stringify({ ...model.getDecorationRange(id) })).sort();
    const expected = buildLiveProjectionDecorations(next.blocks)
      .map((item) => JSON.stringify(item.range))
      .sort();
    assert.deepEqual(actual, expected);
    previous = next;
  }
  updater.clear();
  assert.equal(model.getAllDecorations().length, 0);
  model.dispose();
});
