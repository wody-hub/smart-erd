import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersistedPreviewPositionChanges } from '../../src/lib/preview-position-sync.js';
import type { TableNode } from '../../src/types/erd.js';
import type { DslPreviewNode } from '../../src/lib/dsl-preview-graph.js';

test('buildPersistedPreviewPositionChanges 는 물리명 우선으로 persisted 좌표 변경을 만든다', () => {
  const previewNodes: DslPreviewNode[] = [
    {
      id: 'preview-table:user',
      type: 'previewTable',
      position: { x: 40, y: 80 },
      data: {
        label: 'tb_user',
        logicalTableName: '사용자',
        columns: [],
      },
    },
  ];
  const persistedNodes: TableNode[] = [
    {
      id: 'table-user',
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        label: 'tb_user',
        logicalTableName: '사용자',
        columns: [],
      },
    },
  ];

  assert.deepEqual(
    buildPersistedPreviewPositionChanges(previewNodes, persistedNodes, {
      'preview-table:user': { x: 240, y: 360 },
    }),
    [
      {
        previewNodeId: 'preview-table:user',
        nodeId: 'table-user',
        position: { x: 240, y: 360 },
      },
    ],
  );
});

test('buildPersistedPreviewPositionChanges 는 모호한 논리명/물리명 매칭은 건너뛴다', () => {
  const previewNodes: DslPreviewNode[] = [
    {
      id: 'preview-table:user',
      type: 'previewTable',
      position: { x: 40, y: 80 },
      data: {
        label: 'tb_user',
        logicalTableName: '사용자',
        columns: [],
      },
    },
  ];
  const persistedNodes: TableNode[] = [
    {
      id: 'table-user-1',
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        label: 'tb_user',
        logicalTableName: '사용자',
        columns: [],
      },
    },
    {
      id: 'table-user-2',
      type: 'table',
      position: { x: 120, y: 0 },
      data: {
        label: 'tb_user',
        logicalTableName: '사용자',
        columns: [],
      },
    },
  ];

  assert.deepEqual(
    buildPersistedPreviewPositionChanges(previewNodes, persistedNodes, {
      'preview-table:user': { x: 300, y: 200 },
    }),
    [],
  );
});
