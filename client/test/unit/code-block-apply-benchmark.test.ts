import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Y from 'yjs';
import { applyCodeBlockCommit } from '../../src/collaboration/plugins/erd/erd-code-block-commit.js';
import {
  createTableYMap,
  createEdgeYMap,
  getTablesMap,
  getEdgesMap,
} from '../../src/collaboration/yjsBridge.js';
import { createTrackedCanvasHistoryOrigins } from '../../src/constants/canvas-history.js';
import type { ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';

/** 실제 S200/S500 문서에서 검증·필드 쓰기·undo 경계 비용을 측정한다. */
test('applyCodeBlockCommit S200/S500 benchmark (100 warmup / 1000 samples)', async () => {
  const { buildErdLocalSeed } = (await import(
    pathToFileURL(resolve('scripts/perf/lib/erd-app-seed.mjs')).href
  )) as {
    buildErdLocalSeed: (size: number) => Pick<ProjectionSnapshot, 'nodes' | 'edges'>;
  };
  for (const size of [200, 500]) {
    const seed = buildErdLocalSeed(size);
    const doc = new Y.Doc();
    const tables = getTablesMap(doc),
      edges = getEdgesMap(doc);
    doc.transact(() => {
      for (const node of seed.nodes)
        tables.set(
          node.id,
          createTableYMap(node.data.label, { x: 0, y: 0 }, node.data.columns, node.data),
        );
      for (const edge of seed.edges)
        edges.set(
          edge.id,
          createEdgeYMap(edge.source, edge.target, edge.sourceHandle!, edge.targetHandle!),
        );
    });
    const undo = new Y.UndoManager(tables, { trackedOrigins: createTrackedCanvasHistoryOrigins() });
    const node = seed.nodes[0],
      column = node.data.columns[0];
    const beforeEdges = JSON.stringify(edges.toJSON());
    let previousName = column.name;
    const times: number[] = [];
    for (let index = 0; index < 1100; index++) {
      const nextName = `bench_id_${index}`;
      const commit = {
        kind: 'code-block-v1' as const,
        commitId: `benchmark-${index}`,
        tableId: node.id,
        dictionaryFingerprint: 'empty',
        patches: [
          {
            target: 'column' as const,
            tableId: node.id,
            columnId: column.id,
            field: 'name' as const,
            baseValue: previousName,
            nextValue: nextName,
          },
        ],
      };
      const start = performance.now();
      const result = applyCodeBlockCommit(doc, commit, {
        dictionaryFingerprint: 'empty',
        stopHistoryCapture: () => undo.stopCapturing(),
      });
      const elapsed = performance.now() - start;
      assert.equal(result.status, 'applied');
      if (index >= 100) times.push(elapsed);
      previousName = nextName;
    }
    times.sort((a, b) => a - b);
    console.log(
      `applyCodeBlockCommit S${size} p50=${times[499].toFixed(3)}ms p95=${times[949].toFixed(3)}ms (validation+transaction+undo, 100/1000)`,
    );
    assert.equal(undo.undoStack.length, 1100);
    assert.equal(JSON.stringify(edges.toJSON()), beforeEdges);
    assert.ok(times[949] < 50, '필드 적용 p95는 50ms 미만이어야 한다');
    undo.destroy();
    doc.destroy();
  }
});
