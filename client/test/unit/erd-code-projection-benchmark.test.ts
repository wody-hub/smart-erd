import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Y from 'yjs';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import { collectErdAffectedScopes } from '../../src/collaboration/plugins/erd/erd-yjs-update-scope-collector.js';
import {
  ErdCodeProjectionPort,
  applyErdCodeProjectionBatch,
} from '../../src/collaboration/plugins/erd/erd-code-projection-port.js';
import {
  createTableYMap,
  createEdgeYMap,
  getTablesMap,
  getEdgesMap,
  yTablesMapToNodes,
  yEdgesMapToEdges,
} from '../../src/collaboration/yjsBridge.js';
import { generateProjection, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';
import type { DocumentMutation } from '../../src/collaboration/core/contracts/document-read-executor.js';

/** 실제 store 이벤트 수신부터 배치 전달·문자열 패치 적용까지 측정한다. */
test('S200/S500 projection event->batch benchmark (100 warmup / 1000 samples)', async () => {
  const { buildErdLocalSeed } = (await import(
    pathToFileURL(resolve('scripts/perf/lib/erd-app-seed.mjs')).href
  )) as {
    buildErdLocalSeed: (size: number) => Pick<ProjectionSnapshot, 'nodes' | 'edges'>;
  };
  for (const size of [200, 500]) {
    const seed = buildErdLocalSeed(size);
    const doc = new Y.Doc();
    const tables = getTablesMap(doc);
    const edges = getEdgesMap(doc);
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
    const engine = new YjsSharedDocumentEngine(doc);
    const revisions = new DocumentRevisionTracker();
    const store = new DocumentStore(
      new ErdDocumentMutationApplier(engine),
      revisions,
      new ErdDocumentReadContextFactory(engine, revisions),
      () => engine.exportSnapshot(),
      (update) => collectErdAffectedScopes(engine, update),
    );
    store.attach();
    const unsubscribe = engine.subscribeUpdates((update) =>
      revisions.handleDocumentUpdated(update),
    );
    let eventStart = 0;
    let elapsed = 0;
    store.subscribe(() => {
      eventStart = performance.now();
    });
    const port = new ErdCodeProjectionPort({
      read: store,
      getDocument: () => doc,
      dictionary: { version: 0, fingerprint: 'empty', dictionary: { terms: [], domains: [] } },
    });
    let state = { text: '', revision: 0 };
    let batchCount = 0;
    port.subscribe((batch) => {
      state = applyErdCodeProjectionBatch(state, batch);
      elapsed = performance.now() - eventStart;
      batchCount++;
    });
    port.hydrate();
    const fanout = new Map(seed.nodes.map((node) => [node.id, new Set<string>()]));
    for (const edge of seed.edges) fanout.get(edge.source)!.add(edge.target);
    const parent = [...fanout].sort((a, b) => b[1].size - a[1].size)[0];
    const parentNode = seed.nodes.find((node) => node.id === parent[0])!;
    const childNode = seed.nodes.find((node) => node.id !== parent[0])!;
    const childColumnId = childNode.data.columns.at(-1)!.id;
    /** 실제 mutation을 반영한 뒤 예약 배치를 즉시 완료한다. */
    function apply(mutation: DocumentMutation) {
      assert.equal(store.applyMutation(mutation, { origin: { source: 'local' } }).applied, true);
      port.flush();
    }
    for (const scenario of ['column-rename', 'fk-add', 'parent-rename-fanout']) {
      const times: number[] = [];
      for (let index = 0; index < 1100; index++) {
        if (scenario === 'fk-add' && edges.has('bench-fk')) {
          apply({
            key: 'edge:delete',
            payload: { edgeId: 'bench-fk' },
            affectedScopes: [{ kind: 'edge', id: 'bench-fk', mode: 'shared' }],
          });
        }
        const before = batchCount;
        if (scenario === 'column-rename') {
          apply({
            key: 'column:update',
            payload: {
              tableId: parent[0],
              colId: parentNode.data.columns[0].id,
              logicalName: `번호_${index}`,
            },
            affectedScopes: [{ kind: 'table', id: parent[0], mode: 'shared' }],
          });
        } else if (scenario === 'fk-add') {
          apply({
            key: 'edge:connect',
            payload: {
              edgeId: 'bench-fk',
              sourceTableId: parent[0],
              targetTableId: childNode.id,
              sourceHandle: `${parent[0]}-${parentNode.data.columns[0].id}-source`,
              targetHandle: `${childNode.id}-${childColumnId}-target`,
              relationType: 'non-identifying',
            },
            affectedScopes: [{ kind: 'edge', id: 'bench-fk', mode: 'shared' }],
          });
        } else {
          apply({
            key: 'table:update-meta',
            payload: { tableId: parent[0], logicalTableName: `부모_${index}` },
            affectedScopes: [{ kind: 'table', id: parent[0], mode: 'shared' }],
          });
        }
        assert.equal(batchCount, before + 1);
        if (index >= 100) times.push(elapsed);
      }
      times.sort((a, b) => a - b);
      console.log(
        `projection-port S${size} ${scenario} p50=${times[499].toFixed(3)}ms p95=${times[949].toFixed(3)}ms fanout=${parent[1].size} (event->batch+text apply, 100/1000)`,
      );
      assert.equal(
        state.text,
        generateProjection({
          revision: 0,
          nodes: yTablesMapToNodes(tables),
          edges: yEdgesMapToEdges(edges),
          dictionary: { terms: [], domains: [] },
        }).text,
      );
    }
    port.dispose();
    unsubscribe();
    store.dispose();
    doc.destroy();
  }
});
