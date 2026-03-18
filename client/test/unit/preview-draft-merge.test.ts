import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviewDraftOverlayGraph } from '../../src/lib/preview-draft-merge.js';
import type { DslPreviewGraph } from '../../src/lib/dsl-preview-graph.js';
import type { ERDEdge, TableNode } from '../../src/types/erd.js';

test('buildPreviewDraftOverlayGraph 는 기존 persisted 테이블의 draft 변경도 overlay 노드로 남긴다', () => {
  const previewGraph: DslPreviewGraph = {
    nodes: [
      {
        id: 'preview-table:users',
        type: 'previewTable',
        position: { x: 800, y: 600 },
        data: {
          label: 'users',
          logicalTableName: '사용자',
          columns: [
            {
              id: 'preview-col:users:id',
              name: 'id',
              type: 'bigint',
              pk: true,
              logicalName: '사용자 번호',
            },
            {
              id: 'preview-col:users:name',
              name: 'name',
              type: 'varchar(100)',
              logicalName: '사용자 명',
            },
          ],
        },
      },
    ],
    edges: [],
  };
  const persistedNodes: TableNode[] = [
    {
      id: 'table-users',
      type: 'table',
      position: { x: 120, y: 180 },
      data: {
        label: 'users',
        logicalTableName: '사용자',
        columns: [
          {
            id: 'col-users-id',
            name: 'id',
            type: 'bigint',
            pk: true,
            logicalName: '사용자 번호',
          },
        ],
      },
    },
  ];
  const persistedEdges: ERDEdge[] = [];

  const overlayGraph = buildPreviewDraftOverlayGraph(previewGraph, persistedNodes, persistedEdges);

  assert.ok(overlayGraph);
  assert.equal(overlayGraph.nodes.length, 1);
  assert.equal(overlayGraph.nodes[0]?.id, 'preview-table:users');
  assert.equal(overlayGraph.nodes[0]?.type, 'previewTable');
  assert.deepEqual(overlayGraph.nodes[0]?.position, { x: 120, y: 180 });
});
