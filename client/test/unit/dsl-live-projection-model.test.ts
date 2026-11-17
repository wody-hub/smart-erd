import assert from 'node:assert/strict';
import test from 'node:test';
import { generateProjection, diffProjection } from '../../src/lib/dsl-block-projection.js';
import {
  applyLiveProjectionBatch,
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
