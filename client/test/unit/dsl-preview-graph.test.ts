import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreviewEdgePresentationEntries,
  buildPreviewGraphFromDslParsedSchema,
  buildPreviewLayoutSourceEntries,
  refreshPreviewGraphFromPersistedSources,
  type DslPreviewGraph,
} from '../../src/lib/dsl-preview-graph.js';
import { buildColumnHandleId } from '../../src/lib/handle-id.js';
import type { DdlParseResult } from '../../src/lib/ddl-parser.js';
import type { Column, ERDEdge, TableNode } from '../../src/types/erd.js';

test('buildPreviewGraphFromDslParsedSchema 는 parsed schema를 preview graph로 변환한다', () => {
  const parsedSchema: DdlParseResult = {
    diagnostics: [],
    errors: [],
    tableRanges: [],
    tables: [
      {
        name: 'accident_report',
        logicalTableName: '사고보고',
        columns: [
          {
            name: 'accident_report_id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
            logicalName: '사고보고 번호',
          },
        ],
      },
      {
        name: 'accident_worker',
        logicalTableName: '사고보고 근로자',
        columns: [
          {
            name: 'accident_worker_id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
            logicalName: '사고보고 근로자 번호',
          },
          {
            name: 'accident_report_id',
            type: 'BIGINT',
            pk: false,
            nullable: false,
            autoIncrement: false,
            logicalName: '사고보고 번호',
          },
        ],
      },
    ],
    relations: [
      {
        parentTable: 'accident_report',
        parentColumn: 'accident_report_id',
        childTable: 'accident_worker',
        childColumn: 'accident_report_id',
      },
    ],
  };

  const graph = buildPreviewGraphFromDslParsedSchema(parsedSchema);

  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);

  const childNode = graph.nodes.find((node) => node.data.label === 'accident_worker');
  assert.ok(childNode);
  assert.equal(
    childNode.data.columns.find((column: Column) => column.name === 'accident_report_id')?.fk,
    true,
  );

  const edge = graph.edges[0];
  assert.equal(edge.type, 'erdRelation');
  assert.equal(edge.data?.routingType, 'smoothstep');
  assert.match(edge.sourceHandle ?? '', /-source-/);
  assert.match(edge.targetHandle ?? '', /-target-/);
});

test('buildPreviewGraphFromDslParsedSchema 는 persisted ERD 배치를 우선 재사용한다', () => {
  const parsedSchema: DdlParseResult = {
    diagnostics: [],
    errors: [],
    tableRanges: [],
    tables: [
      {
        name: 'accident_report',
        logicalTableName: '사고보고',
        columns: [],
      },
      {
        name: 'accident_worker',
        logicalTableName: '사고보고 근로자',
        columns: [],
      },
    ],
    relations: [],
  };

  const persistedNodes: TableNode[] = [
    {
      id: 'table-1',
      type: 'table',
      position: { x: 240, y: 180 },
      data: {
        label: 'legacy_ignored',
        logicalTableName: '사고보고',
        headerColor: 'green',
        handleLayout: 'right',
        columns: [],
      },
    },
  ];

  const graph = buildPreviewGraphFromDslParsedSchema(
    parsedSchema,
    buildPreviewLayoutSourceEntries(persistedNodes),
  );

  const persistedNode = graph.nodes.find((node) => node.data.logicalTableName === '사고보고');
  const newNode = graph.nodes.find((node) => node.data.logicalTableName === '사고보고 근로자');

  assert.ok(persistedNode);
  assert.ok(newNode);
  assert.deepEqual(persistedNode.position, { x: 240, y: 180 });
  assert.equal(persistedNode.data.headerColor, 'green');
  assert.equal(persistedNode.data.handleLayout, 'right');
  assert.ok(newNode.position.x > persistedNode.position.x);
});

test('buildPreviewGraphFromDslParsedSchema 는 persisted 선 표현을 preview edge에 재사용한다', () => {
  const parsedSchema: DdlParseResult = {
    diagnostics: [],
    errors: [],
    tableRanges: [],
    tables: [
      {
        name: 'accident_report',
        logicalTableName: '사고보고',
        columns: [
          {
            name: 'accident_report_id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
            logicalName: '사고보고 번호',
          },
        ],
      },
      {
        name: 'accident_worker',
        logicalTableName: '사고보고 근로자',
        columns: [
          {
            name: 'accident_worker_id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
            autoIncrement: true,
            logicalName: '사고보고 근로자 번호',
          },
          {
            name: 'accident_report_id',
            type: 'BIGINT',
            pk: false,
            nullable: false,
            autoIncrement: false,
            logicalName: '사고보고 번호',
          },
        ],
      },
    ],
    relations: [
      {
        parentTable: 'accident_report',
        parentColumn: 'accident_report_id',
        childTable: 'accident_worker',
        childColumn: 'accident_report_id',
      },
    ],
  };

  const persistedNodes: TableNode[] = [
    {
      id: 'table-report',
      type: 'table',
      position: { x: 100, y: 120 },
      data: {
        label: 'accident_report',
        logicalTableName: '사고보고',
        columns: [
          {
            id: 'col-report-id',
            name: 'accident_report_id',
            type: 'BIGINT',
            logicalName: '사고보고 번호',
            pk: true,
            nullable: false,
          },
        ],
      },
    },
    {
      id: 'table-worker',
      type: 'table',
      position: { x: 420, y: 120 },
      data: {
        label: 'accident_worker',
        logicalTableName: '사고보고 근로자',
        columns: [
          {
            id: 'col-worker-id',
            name: 'accident_worker_id',
            type: 'BIGINT',
            logicalName: '사고보고 근로자 번호',
            pk: true,
            nullable: false,
          },
          {
            id: 'col-worker-report-id',
            name: 'accident_report_id',
            type: 'BIGINT',
            logicalName: '사고보고 번호',
            nullable: false,
          },
        ],
        handleLayout: 'right',
      },
    },
  ];
  const persistedEdges: ERDEdge[] = [
    {
      id: 'edge-1',
      source: 'table-report',
      target: 'table-worker',
      sourceHandle: buildColumnHandleId('table-report', 'col-report-id', 'source', 'right'),
      targetHandle: buildColumnHandleId('table-worker', 'col-worker-report-id', 'target', 'right'),
      data: {
        relationType: 'non-identifying',
        routingType: 'straight',
        handleMode: 'manual',
        sourceSide: 'right',
        targetSide: 'right',
        waypoints: [{ x: 320, y: 180 }],
      },
    } as ERDEdge,
  ];

  const graph = buildPreviewGraphFromDslParsedSchema(
    parsedSchema,
    buildPreviewLayoutSourceEntries(persistedNodes),
    buildPreviewEdgePresentationEntries(persistedNodes, persistedEdges),
  );

  const edge = graph.edges[0];
  assert.equal(edge.data?.routingType, 'straight');
  assert.equal(edge.data?.handleMode, 'manual');
  assert.equal(edge.data?.sourceSide, 'right');
  assert.equal(edge.data?.targetSide, 'right');
  assert.deepEqual(edge.data?.waypoints, [{ x: 320, y: 180 }]);
  assert.match(edge.sourceHandle ?? '', /-source-right$/);
  assert.match(edge.targetHandle ?? '', /-target-right$/);
});

test('refreshPreviewGraphFromPersistedSources 는 오류 상태에서도 persisted 좌표와 선 표현을 다시 반영한다', () => {
  const staleGraph: DslPreviewGraph = {
    nodes: [
      {
        id: 'preview-table:accident_report',
        type: 'previewTable',
        position: { x: 0, y: 0 },
        data: {
          label: 'accident_report',
          logicalTableName: '사고보고',
          columns: [
            {
              id: 'preview-col:accident_report:accident_report_id',
              name: 'accident_report_id',
              type: 'BIGINT',
            },
          ],
        },
      },
      {
        id: 'preview-table:accident_worker',
        type: 'previewTable',
        position: { x: 300, y: 0 },
        data: {
          label: 'accident_worker',
          logicalTableName: '사고보고 근로자',
          columns: [
            {
              id: 'preview-col:accident_worker:accident_report_id',
              name: 'accident_report_id',
              type: 'BIGINT',
            },
          ],
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'preview-table:accident_report',
        target: 'preview-table:accident_worker',
        sourceHandle:
          'preview-table:accident_report-preview-col:accident_report:accident_report_id-source-right',
        targetHandle:
          'preview-table:accident_worker-preview-col:accident_worker:accident_report_id-target-left',
        data: {
          relationType: 'non-identifying' as const,
          routingType: 'smoothstep' as const,
        },
      },
    ],
  };
  const persistedNodes: TableNode[] = [
    {
      id: 'table-report',
      type: 'table',
      position: { x: 200, y: 100 },
      data: {
        label: 'accident_report',
        logicalTableName: '사고보고',
        headerColor: 'blue',
        columns: [
          {
            id: 'col-report-id',
            name: 'accident_report_id',
            type: 'BIGINT',
          },
        ],
      },
    },
    {
      id: 'table-worker',
      type: 'table',
      position: { x: 560, y: 100 },
      data: {
        label: 'accident_worker',
        logicalTableName: '사고보고 근로자',
        handleLayout: 'right',
        columns: [
          {
            id: 'col-worker-report-id',
            name: 'accident_report_id',
            type: 'BIGINT',
          },
        ],
      },
    },
  ];
  const persistedEdges: ERDEdge[] = [
    {
      id: 'edge-1',
      source: 'table-report',
      target: 'table-worker',
      sourceHandle: buildColumnHandleId('table-report', 'col-report-id', 'source', 'right'),
      targetHandle: buildColumnHandleId('table-worker', 'col-worker-report-id', 'target', 'right'),
      data: {
        relationType: 'non-identifying',
        routingType: 'straight',
        handleMode: 'manual',
        sourceSide: 'right',
        targetSide: 'right',
        waypoints: [{ x: 430, y: 140 }],
      },
    } as ERDEdge,
  ];

  const refreshed = refreshPreviewGraphFromPersistedSources(
    staleGraph,
    buildPreviewLayoutSourceEntries(persistedNodes),
    buildPreviewEdgePresentationEntries(persistedNodes, persistedEdges),
  );

  assert.deepEqual(refreshed.nodes[0].position, { x: 200, y: 100 });
  assert.equal(refreshed.nodes[0].data.headerColor, 'blue');
  assert.equal(refreshed.nodes[1].data.handleLayout, 'right');
  assert.equal(refreshed.edges[0].data?.routingType, 'straight');
  assert.equal(refreshed.edges[0].data?.handleMode, 'manual');
  assert.equal(refreshed.edges[0].data?.targetSide, 'right');
  assert.deepEqual(refreshed.edges[0].data?.waypoints, [{ x: 430, y: 140 }]);
});
