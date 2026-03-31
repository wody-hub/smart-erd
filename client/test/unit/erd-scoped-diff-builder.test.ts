import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildScopedDiffPlan } from '../../src/lib/erd-scoped-diff-builder.js';
import type {
  CurrentEdgeSnapshot,
  CurrentTableSnapshot,
  DiffParsedRelation,
  DiffParsedTable,
} from '../../src/lib/erd-diff-plan.js';

const currentTables: CurrentTableSnapshot[] = [
  {
    id: 't-user',
    name: 'user',
    logicalTableName: '사용자',
    position: { x: 0, y: 0 },
    columns: [
      {
        id: 'c-user-id',
        name: 'user_id',
        type: 'bigint',
        pk: true,
        nullable: false,
        autoIncrement: true,
        logicalName: '사용자 번호',
        termId: 1,
        domainId: 1,
      },
      {
        id: 'c-user-name',
        name: 'user_name',
        type: 'varchar(100)',
        pk: false,
        nullable: false,
        autoIncrement: false,
        logicalName: '사용자 명',
        termId: 2,
        domainId: 2,
      },
    ],
  },
  {
    id: 't-order',
    name: 'order',
    logicalTableName: '주문',
    position: { x: 400, y: 0 },
    columns: [
      {
        id: 'c-order-id',
        name: 'order_id',
        type: 'bigint',
        pk: true,
        nullable: false,
        autoIncrement: true,
        logicalName: '주문 번호',
        termId: 3,
        domainId: 1,
      },
      {
        id: 'c-order-user-id',
        name: 'user_id',
        type: 'bigint',
        pk: false,
        nullable: false,
        autoIncrement: false,
        logicalName: '사용자 번호',
        termId: 1,
        domainId: 1,
      },
    ],
  },
];

const currentEdges: CurrentEdgeSnapshot[] = [
  {
    id: 'e-1',
    source: 't-user',
    target: 't-order',
    sourceHandle: 't-user-c-user-id-source-right',
    targetHandle: 't-order-c-order-user-id-target-left',
    relationType: 'non-identifying',
    routingType: 'smoothstep',
  },
];

test('buildScopedDiffPlan 는 단일 테이블 컬럼 수정만 추려낸다', () => {
  const nextTables: DiffParsedTable[] = [
    {
      name: 'user',
      logicalTableName: '사용자',
      tableTermId: 10,
      columns: [
        {
          name: 'user_id',
          type: 'bigint',
          pk: true,
          nullable: false,
          autoIncrement: true,
          logicalName: '사용자 번호',
          termId: 1,
          domainId: 1,
        },
        {
          name: 'user_name',
          type: 'varchar(200)',
          pk: false,
          nullable: false,
          autoIncrement: false,
          logicalName: '사용자 명',
          termId: 2,
          domainId: 2,
        },
      ],
    },
    {
      name: 'order',
      logicalTableName: '주문',
      tableTermId: 20,
      columns: [
        {
          name: 'order_id',
          type: 'bigint',
          pk: true,
          nullable: false,
          autoIncrement: true,
          logicalName: '주문 번호',
          termId: 3,
          domainId: 1,
        },
        {
          name: 'user_id',
          type: 'bigint',
          pk: false,
          nullable: false,
          autoIncrement: false,
          logicalName: '사용자 번호',
          termId: 1,
          domainId: 1,
        },
      ],
    },
  ];

  const result = buildScopedDiffPlan(currentTables, currentEdges, nextTables, [
    {
      parentTable: 'user',
      parentColumn: 'user_id',
      childTable: 'order',
      childColumn: 'user_id',
    },
  ]);

  assert.equal(result.safe, true);
  assert.equal(result.plan.tables.length, 1);
  assert.equal(result.plan.tables[0]?.entity, 'table');
  assert.equal(result.plan.tables[0]?.op, 'update');
  assert.equal(result.plan.summary.columnUpdates, 1);
  assert.equal(result.plan.summary.totalOperations, 2);
});

test('buildScopedDiffPlan 는 추가와 삭제가 동시에 있으면 안전하게 fallback 한다', () => {
  const nextTables: DiffParsedTable[] = [
    {
      name: 'customer',
      logicalTableName: '고객',
      tableTermId: 30,
      columns: [
        {
          name: 'customer_id',
          type: 'bigint',
          pk: true,
          nullable: false,
          autoIncrement: true,
          logicalName: '고객 번호',
          termId: 4,
          domainId: 1,
        },
      ],
    },
    {
      name: 'order',
      logicalTableName: '주문',
      tableTermId: 20,
      columns: [
        {
          name: 'order_id',
          type: 'bigint',
          pk: true,
          nullable: false,
          autoIncrement: true,
          logicalName: '주문 번호',
          termId: 3,
          domainId: 1,
        },
      ],
    },
  ];
  const nextRelations: DiffParsedRelation[] = [];

  const result = buildScopedDiffPlan(currentTables, currentEdges, nextTables, nextRelations);

  assert.equal(result.safe, false);
  assert.equal(result.unsafeReason, 'mixed-add-delete');
});

test('buildScopedDiffPlan 는 테이블 본문이 같아도 관계 변경을 scoped 대상으로 포함한다', () => {
  const nextTables: DiffParsedTable[] = [
    {
      name: 'user',
      logicalTableName: '사용자',
      tableTermId: 10,
      columns: [
        {
          name: 'user_id',
          type: 'bigint',
          pk: true,
          nullable: false,
          autoIncrement: true,
          logicalName: '사용자 번호',
          termId: 1,
          domainId: 1,
        },
        {
          name: 'user_name',
          type: 'varchar(100)',
          pk: false,
          nullable: false,
          autoIncrement: false,
          logicalName: '사용자 명',
          termId: 2,
          domainId: 2,
        },
      ],
    },
    {
      name: 'order',
      logicalTableName: '주문',
      tableTermId: 20,
      columns: [
        {
          name: 'order_id',
          type: 'bigint',
          pk: true,
          nullable: false,
          autoIncrement: true,
          logicalName: '주문 번호',
          termId: 3,
          domainId: 1,
        },
        {
          name: 'user_id',
          type: 'bigint',
          pk: false,
          nullable: false,
          autoIncrement: false,
          logicalName: '사용자 번호',
          termId: 1,
          domainId: 1,
        },
      ],
    },
  ];

  const result = buildScopedDiffPlan(currentTables, currentEdges, nextTables, []);

  assert.equal(result.safe, true);
  assert.equal(result.plan.tables.length, 0);
  assert.equal(result.plan.columns.length, 0);
  assert.equal(result.plan.edges.length, 1);
  assert.equal(result.plan.edges[0]?.entity, 'edge');
  assert.equal(result.plan.edges[0]?.op, 'delete');
});
