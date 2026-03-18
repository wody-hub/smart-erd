import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreviewGraphFromDslParsedSchema,
  buildPreviewLayoutSourceEntries,
} from '../../src/lib/dsl-preview-graph.js';
import type { DdlParseResult } from '../../src/lib/ddl-parser.js';
import type { Column, TableNode } from '../../src/types/erd.js';

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
