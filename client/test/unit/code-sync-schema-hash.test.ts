import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildParsedSchemaHash,
  buildPersistedDiagramSchemaHash,
} from '../../src/lib/code-sync-schema-hash.js';
import type { DdlParseResult } from '../../src/lib/ddl-parser.js';

function createParseResult(overrides?: Partial<DdlParseResult>): DdlParseResult {
  return {
    diagnostics: [],
    errors: [],
    tableRanges: [],
    tables: [
      {
        name: 'worker',
        logicalTableName: '근로자',
        tableTermId: 10,
        columns: [
          {
            name: 'worker_id',
            logicalName: '근로자 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: true,
            termId: 20,
            domainId: 30,
          },
        ],
      },
    ],
    relations: [],
    ...overrides,
  };
}

test('buildParsedSchemaHash 는 동일 스키마면 컬럼 순서가 달라도 같은 해시를 반환한다', () => {
  const a = createParseResult({
    tables: [
      {
        name: 'worker',
        logicalTableName: '근로자',
        tableTermId: 10,
        columns: [
          {
            name: 'worker_name',
            logicalName: '근로자 명',
            type: 'varchar(100)',
            pk: false,
            nullable: false,
            autoIncrement: false,
            termId: 21,
            domainId: 31,
          },
          {
            name: 'worker_id',
            logicalName: '근로자 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: true,
            termId: 20,
            domainId: 30,
          },
        ],
      },
    ],
  });
  const b = createParseResult({
    tables: [
      {
        name: 'worker',
        logicalTableName: '근로자',
        tableTermId: 10,
        columns: [
          {
            name: 'worker_id',
            logicalName: '근로자 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: true,
            termId: 20,
            domainId: 30,
          },
          {
            name: 'worker_name',
            logicalName: '근로자 명',
            type: 'varchar(100)',
            pk: false,
            nullable: false,
            autoIncrement: false,
            termId: 21,
            domainId: 31,
          },
        ],
      },
    ],
  });

  assert.equal(buildParsedSchemaHash(a), buildParsedSchemaHash(b));
});

test('buildParsedSchemaHash 는 의미 있는 스키마 변경 시 다른 해시를 반환한다', () => {
  const a = createParseResult();
  const b = createParseResult({
    tables: [
      {
        name: 'worker',
        logicalTableName: '근로자',
        tableTermId: 10,
        columns: [
          {
            name: 'worker_id',
            logicalName: '근로자 번호',
            type: 'uuid',
            pk: true,
            nullable: false,
            autoIncrement: false,
            termId: 20,
            domainId: 30,
          },
        ],
      },
    ],
  });

  assert.notEqual(buildParsedSchemaHash(a), buildParsedSchemaHash(b));
});

test('buildPersistedDiagramSchemaHash 는 parsed schema 와 의미 구조가 같으면 같은 해시를 반환한다', () => {
  const parsed = createParseResult({
    tables: [
      {
        name: 'worker',
        logicalTableName: '근로자',
        tableTermId: 10,
        columns: [
          {
            name: 'worker_id',
            logicalName: '근로자 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: true,
            termId: 20,
            domainId: 30,
          },
          {
            name: 'company_id',
            logicalName: '회사 번호',
            type: 'bigint',
            pk: false,
            nullable: false,
            autoIncrement: false,
            termId: 21,
            domainId: 31,
          },
        ],
      },
      {
        name: 'company',
        logicalTableName: '회사',
        tableTermId: 11,
        columns: [
          {
            name: 'company_id',
            logicalName: '회사 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: false,
            termId: 22,
            domainId: 32,
          },
        ],
      },
    ],
    relations: [
      {
        parentTable: 'company',
        parentColumn: 'company_id',
        childTable: 'worker',
        childColumn: 'company_id',
      },
    ],
  });

  const persistedNodes = [
    {
      id: 'table-db-a',
      type: 'table',
      position: { x: 10, y: 20 },
      data: {
        label: 'worker',
        logicalTableName: '근로자',
        tableTermId: 10,
        headerColor: 'blue',
        columns: [
          {
            id: 'worker-col-2',
            name: 'company_id',
            logicalName: '회사 번호',
            type: 'bigint',
            pk: false,
            nullable: false,
            autoIncrement: false,
            termId: 21,
            domainId: 31,
          },
          {
            id: 'worker-col-1',
            name: 'worker_id',
            logicalName: '근로자 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: true,
            termId: 20,
            domainId: 30,
          },
        ],
      },
    },
    {
      id: 'table-db-b',
      type: 'table',
      position: { x: 420, y: 80 },
      data: {
        label: 'company',
        logicalTableName: '회사',
        tableTermId: 11,
        handleLayout: 'right',
        columns: [
          {
            id: 'company-col-1',
            name: 'company_id',
            logicalName: '회사 번호',
            type: 'bigint',
            pk: true,
            nullable: false,
            autoIncrement: false,
            termId: 22,
            domainId: 32,
          },
        ],
      },
    },
  ];
  const persistedEdges = [
    {
      id: 'edge-db-1',
      source: 'table-db-b',
      target: 'table-db-a',
      sourceHandle: 'table-db-b-company-col-1-source-right',
      targetHandle: 'table-db-a-worker-col-2-target-left',
      type: 'erdRelation',
      data: {
        relationType: 'non-identifying',
        routingType: 'bezier',
      },
    },
  ];

  assert.equal(
    buildPersistedDiagramSchemaHash(persistedNodes as never, persistedEdges as never),
    buildParsedSchemaHash(parsed),
  );
});

test('buildPersistedDiagramSchemaHash 는 identifying 관계가 있으면 null 을 반환한다', () => {
  const persistedNodes = [
    {
      id: 'table-db-a',
      type: 'table',
      position: { x: 10, y: 20 },
      data: {
        label: 'worker',
        columns: [{ id: 'worker-col-1', name: 'worker_id', type: 'bigint' }],
      },
    },
    {
      id: 'table-db-b',
      type: 'table',
      position: { x: 420, y: 80 },
      data: {
        label: 'company',
        columns: [{ id: 'company-col-1', name: 'company_id', type: 'bigint' }],
      },
    },
  ];
  const persistedEdges = [
    {
      id: 'edge-db-1',
      source: 'table-db-b',
      target: 'table-db-a',
      sourceHandle: 'table-db-b-company-col-1-source-right',
      targetHandle: 'table-db-a-worker-col-1-target-left',
      type: 'erdRelation',
      data: {
        relationType: 'identifying',
      },
    },
  ];

  assert.equal(buildPersistedDiagramSchemaHash(persistedNodes as never, persistedEdges as never), null);
});

test('buildPersistedDiagramSchemaHash 는 persisted 관계를 해석하지 못하면 null 을 반환한다', () => {
  const persistedNodes = [
    {
      id: 'table-db-a',
      type: 'table',
      position: { x: 10, y: 20 },
      data: {
        label: 'worker',
        columns: [{ id: 'worker-col-1', name: 'worker_id', type: 'bigint' }],
      },
    },
    {
      id: 'table-db-b',
      type: 'table',
      position: { x: 420, y: 80 },
      data: {
        label: 'company',
        columns: [{ id: 'company-col-1', name: 'company_id', type: 'bigint' }],
      },
    },
  ];
  const persistedEdges = [
    {
      id: 'edge-db-1',
      source: 'table-db-b',
      target: 'table-db-a',
      sourceHandle: 'table-db-b-missing-col-source-right',
      targetHandle: 'table-db-a-worker-col-1-target-left',
      type: 'erdRelation',
      data: {
        relationType: 'non-identifying',
      },
    },
  ];

  assert.equal(buildPersistedDiagramSchemaHash(persistedNodes as never, persistedEdges as never), null);
});
