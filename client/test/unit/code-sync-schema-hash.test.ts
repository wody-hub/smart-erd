import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParsedSchemaHash } from '../../src/lib/code-sync-schema-hash.js';
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
