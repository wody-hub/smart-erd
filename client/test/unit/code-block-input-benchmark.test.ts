import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { editor, IRange } from 'monaco-editor';
import {
  layoutEditableProjection,
  readEditableBlockChange,
} from '../../src/lib/dsl-editable-projection-model.js';
import { generateProjection } from '../../src/lib/dsl-block-projection.js';
import { buildLiveProjectionDecorations } from '../../src/lib/dsl-live-projection-model.js';

/** S200/S500 크기의 가짜 읽기 모델로 이전 전체 수집과 현재 블록 수집을 비교한다. */
for (const size of [200, 500])
  test(`per-keystroke block handler S${size} p95 <= 2ms`, (t) => {
    const projection = layoutEditableProjection(
      generateProjection({
        revision: 1,
        edges: [],
        dictionary: { terms: [], domains: [] },
        nodes: Array.from({ length: size }, (_, i) => ({
          id: `t-${i}`,
          data: {
            label: `table_${i}`,
            columns: Array.from({ length: 20 }, (_, j) => ({
              id: `c-${i}-${j}`,
              name: `column_${j}`,
              type: 'VARCHAR(255)',
              nullable: true,
            })),
          },
        })),
      }).blocks,
      1,
    );
    const lines = projection.text.split('\n');
    const starts: number[] = [];
    let at = 0;
    for (const line of lines) {
      starts.push(at);
      at += line.length + 1;
    }
    const block = projection.blocks[Math.floor(size / 2)];
    const range = {
      startLineNumber: block.tableRange.startLine,
      startColumn: block.tableRange.startColumn,
      endLineNumber: block.tableRange.endLine,
      endColumn: block.tableRange.endColumn,
    };
    let fullReads = 0,
      blockReads = 0;
    const offset = (pos: { lineNumber: number; column: number }) =>
      starts[pos.lineNumber - 1] + pos.column - 1;
    const model = {
      getValue: () => {
        fullReads++;
        return projection.text;
      },
      getOffsetAt: offset,
      getValueInRange: (range: IRange) => {
        blockReads++;
        return projection.text.slice(
          offset({ lineNumber: range.startLineNumber, column: range.startColumn }),
          offset({ lineNumber: range.endLineNumber, column: range.endColumn }),
        );
      },
      getDecorationsInRange: () => [{ options: { className: 'table' }, range }],
    };
    const event = {
      changes: [
        {
          range: {
            startLineNumber: range.startLineNumber + 1,
            endLineNumber: range.startLineNumber + 1,
            startColumn: 5,
            endColumn: 6,
          },
          rangeOffset: starts[range.startLineNumber] + 4,
          rangeLength: 1,
          text: 'x',
        },
      ],
    } as editor.IModelContentChangedEvent;
    const ids = new Map([['table', block.tableId]]);
    /** 수정 전 훅의 전체 모델·블록·컬럼 수집 및 구조 비교 비용을 재현한다. */
    const before = () => {
      const text = model.getValue();
      const blocks = projection.blocks.map((item) => ({
        ...item,
        text: model.getValueInRange({
          startLineNumber: item.tableRange.startLine,
          startColumn: item.tableRange.startColumn,
          endLineNumber: item.tableRange.endLine,
          endColumn: item.tableRange.endColumn,
        }),
        columnRanges: item.columnRanges.map((column) => ({
          ...column,
          start: offset({ lineNumber: column.startLine, column: column.startColumn }),
          end: offset({ lineNumber: column.endLine, column: column.endColumn }),
        })),
      }));
      return blocks.map((item) => item.text).join('\n') === text;
    };
    /** 수정 후 입력 경로처럼 변경 블록의 텍스트·컬럼 범위·decoration만 만든다. */
    const after = () => {
      const changed = readEditableBlockChange(model as unknown as editor.ITextModel, event, ids);
      if (!changed) return;
      const edited = {
        ...block,
        text: changed.text,
        columnRanges: block.columnRanges.map((column) => ({
          ...column,
          start: offset({ lineNumber: column.startLine, column: 1 }),
          end: offset({
            lineNumber: column.startLine,
            column: lines[column.startLine - 1].length + 1,
          }),
          endColumn: lines[column.startLine - 1].length + 1,
        })),
      };
      buildLiveProjectionDecorations([edited]);
      return changed;
    };
    assert.equal(before(), true);
    const fullBefore = fullReads,
      blockBefore = blockReads;
    assert.equal(after()?.tableId, block.tableId);
    assert.equal(fullReads, fullBefore);
    assert.equal(blockReads - blockBefore, 1);
    /** 준비 실행 후 개별 입력의 p50·p95를 계산한다. */
    const measure = (run: () => unknown) => {
      for (let i = 0; i < 30; i++) run();
      const samples = Array.from({ length: 250 }, () => {
        const start = performance.now();
        run();
        return performance.now() - start;
      }).sort((a, b) => a - b);
      return { p50: samples[125], p95: samples[237] };
    };
    const old = measure(before),
      next = measure(after);
    t.diagnostic(
      `S${size} before p50=${old.p50.toFixed(4)}ms p95=${old.p95.toFixed(4)}ms; after p50=${next.p50.toFixed(4)}ms p95=${next.p95.toFixed(4)}ms`,
    );
    assert.ok(next.p95 <= 2, `p95=${next.p95}ms`);
  });
