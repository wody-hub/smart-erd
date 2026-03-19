import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { buildWordMatchIndex } from '../../src/lib/word-composition.js';
import {
  buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft,
  buildParseResultFromSharedSchemaDraft,
  clearSharedSchemaDraft,
  hasSharedSchemaDraftContent,
  readSharedSchemaDraftSnapshot,
  shouldClearSharedSchemaDraftAfterPersistedApply,
  writeSharedSchemaDraftPositions,
  writeSharedSchemaDraftSnapshot,
} from '../../src/lib/shared-schema-draft.js';
import type { Word } from '../../src/types/dictionary.js';

function createWord(id: number, logicalName: string, physicalName: string): Word {
  return {
    id,
    logicalName,
    physicalName,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    createdAt: '2026-03-19T00:00:00Z',
    updatedAt: '2026-03-19T00:00:00Z',
  };
}

test('writeSharedSchemaDraftSnapshot 는 schema draft 전체를 round-trip 한다', () => {
  const doc = new Y.Doc();

  writeSharedSchemaDraftSnapshot(
    doc,
    {
      mode: 'dsl',
      baselineRevision: 'rev-1',
      schemaHash: 'schema-hash-1',
      tables: [
        {
          name: 'user',
          logicalTableName: '사용자',
          columns: [
            {
              name: 'user_id',
              logicalName: '사용자 번호',
              type: 'BIGINT',
              pk: true,
              nullable: false,
              autoIncrement: true,
            },
          ],
        },
      ],
      relations: [],
      positions: {
        'preview-table:user': { x: 120, y: 240 },
      },
      isIntentionalBlank: false,
      isConfirmedBlank: false,
    },
    'test-origin',
  );

  const snapshot = readSharedSchemaDraftSnapshot(doc);
  assert.equal(snapshot.mode, 'dsl');
  assert.equal(snapshot.baselineRevision, 'rev-1');
  assert.equal(snapshot.schemaHash, 'schema-hash-1');
  assert.deepEqual(snapshot.tables, [
    {
      name: 'user',
      logicalTableName: '사용자',
      columns: [
        {
          name: 'user_id',
          logicalName: '사용자 번호',
          type: 'BIGINT',
          pk: true,
          nullable: false,
          autoIncrement: true,
        },
      ],
    },
  ]);
  assert.deepEqual(snapshot.relations, []);
  assert.deepEqual(snapshot.positions, {
    'preview-table:user': { x: 120, y: 240 },
  });
  assert.equal(snapshot.isIntentionalBlank, false);
  assert.equal(snapshot.isConfirmedBlank, false);
  assert.equal(typeof snapshot.updatedAt, 'number');
});

test('hasSharedSchemaDraftContent 는 confirmed blank 도 유효 draft 로 본다', () => {
  assert.equal(
    hasSharedSchemaDraftContent({
      mode: 'dsl',
      baselineRevision: null,
      schemaHash: null,
      tables: [],
      relations: [],
      positions: {},
      isIntentionalBlank: true,
      isConfirmedBlank: true,
      updatedAt: null,
    }),
    true,
  );
});

test('writeSharedSchemaDraftPositions 는 위치 정보만 갱신한다', () => {
  const doc = new Y.Doc();

  writeSharedSchemaDraftSnapshot(
    doc,
    {
      mode: 'dsl',
      baselineRevision: 'rev-2',
      schemaHash: 'schema-hash-2',
      tables: [{ name: 'dept', columns: [] }],
      relations: [],
      positions: {},
      isIntentionalBlank: false,
      isConfirmedBlank: false,
    },
    'test-origin',
  );

  writeSharedSchemaDraftPositions(
    doc,
    {
      'preview-table:dept': { x: 10, y: 20 },
    },
    'position-origin',
  );

  const snapshot = readSharedSchemaDraftSnapshot(doc);
  assert.equal(snapshot.schemaHash, 'schema-hash-2');
  assert.deepEqual(snapshot.positions, {
    'preview-table:dept': { x: 10, y: 20 },
  });
});

test('shouldClearSharedSchemaDraftAfterPersistedApply 는 schema hash 가 일치하면 clear 대상으로 본다', () => {
  assert.equal(
    shouldClearSharedSchemaDraftAfterPersistedApply(
      {
        mode: 'dsl',
        baselineRevision: 'rev-apply',
        schemaHash: 'schema-hash-apply',
        tables: [{ name: 'dept', columns: [] }],
        relations: [],
        positions: {
          'preview-table:dept': { x: 10, y: 20 },
        },
        isIntentionalBlank: false,
        isConfirmedBlank: false,
        updatedAt: null,
      },
      'schema-hash-apply',
    ),
    true,
  );
});

test('shouldClearSharedSchemaDraftAfterPersistedApply 는 positions-only draft 도 clear 대상으로 본다', () => {
  assert.equal(
    shouldClearSharedSchemaDraftAfterPersistedApply(
      {
        mode: 'dsl',
        baselineRevision: 'rev-position-only',
        schemaHash: null,
        tables: [],
        relations: [],
        positions: {
          'preview-table:dept': { x: 10, y: 20 },
        },
        isIntentionalBlank: false,
        isConfirmedBlank: false,
        updatedAt: null,
      },
      null,
    ),
    true,
  );
});

test('shouldClearSharedSchemaDraftAfterPersistedApply 는 완전히 빈 draft 는 clear 대상으로 보지 않는다', () => {
  assert.equal(
    shouldClearSharedSchemaDraftAfterPersistedApply(
      {
        mode: 'dsl',
        baselineRevision: null,
        schemaHash: null,
        tables: [],
        relations: [],
        positions: {},
        isIntentionalBlank: false,
        isConfirmedBlank: false,
        updatedAt: null,
      },
      null,
    ),
    false,
  );
});

test('clearSharedSchemaDraft 는 snapshot 전체를 제거한다', () => {
  const doc = new Y.Doc();

  writeSharedSchemaDraftSnapshot(
    doc,
    {
      mode: 'dsl',
      baselineRevision: 'rev-3',
      schemaHash: 'schema-hash-3',
      tables: [{ name: 'post', columns: [] }],
      relations: [{ childTable: 'post', childColumn: 'user_id', parentTable: 'user', parentColumn: 'user_id' }],
      positions: {
        'preview-table:post': { x: 1, y: 2 },
      },
      isIntentionalBlank: false,
      isConfirmedBlank: false,
    },
    'test-origin',
  );

  clearSharedSchemaDraft(doc, 'clear-origin');

  assert.deepEqual(readSharedSchemaDraftSnapshot(doc), {
    mode: 'dsl',
    baselineRevision: null,
    schemaHash: null,
    tables: [],
    relations: [],
    positions: {},
    isIntentionalBlank: false,
    isConfirmedBlank: false,
    updatedAt: readSharedSchemaDraftSnapshot(doc).updatedAt,
  });
});

test('buildParseResultFromSharedSchemaDraft 는 preview/generator 입력용 schema 를 만든다', () => {
  const parseResult = buildParseResultFromSharedSchemaDraft({
    mode: 'dsl',
    baselineRevision: 'rev-4',
    schemaHash: 'schema-hash-4',
    tables: [{ name: 'comment', columns: [] }],
    relations: [],
    positions: {},
    isIntentionalBlank: false,
    isConfirmedBlank: false,
    updatedAt: null,
  });

  assert.deepEqual(parseResult, {
    diagnostics: [],
    errors: [],
    tableRanges: [],
    tables: [{ name: 'comment', columns: [] }],
    relations: [],
  });
});

test('buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft 는 legacy shared code draft를 schema draft로 승격한다', () => {
  const words = [createWord(1, '사용자', 'user'), createWord(2, '아이디', 'id')];

  const migrated = buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft(
    {
      text: 'Table 사용자 {\n  사용자 아이디\n}\n',
      baselineRevision: 'rev-legacy',
      isIntentionalBlank: false,
      isConfirmedBlank: false,
      graph: {
        nodes: [
          {
            id: 'preview-table:%EC%82%AC%EC%9A%A9%EC%9E%90',
            type: 'previewTable',
            position: { x: 120, y: 240 },
            data: { label: '사용자', columns: [] },
          },
        ],
        edges: [],
      },
      updatedAt: null,
    },
    {
      termByName: new Map(),
      domainByName: new Map(),
      domainById: new Map(),
      wordMatchIndex: buildWordMatchIndex(words),
    },
  );

  assert.ok(migrated);
  assert.equal(migrated?.mode, 'dsl');
  assert.equal(migrated?.baselineRevision, 'rev-legacy');
  assert.equal(migrated?.tables.length, 1);
  assert.deepEqual(migrated?.positions, {
    'preview-table:%EC%82%AC%EC%9A%A9%EC%9E%90': { x: 120, y: 240 },
  });
});

test('buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft 는 confirmed blank를 빈 schema draft로 보존한다', () => {
  const migrated = buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft(
    {
      text: '',
      baselineRevision: 'rev-blank',
      isIntentionalBlank: true,
      isConfirmedBlank: true,
      graph: null,
      updatedAt: null,
    },
    {
      termByName: new Map(),
      domainByName: new Map(),
      domainById: new Map(),
      wordMatchIndex: { exactCandidatesByNormalized: new Map() },
    },
  );

  assert.deepEqual(migrated, {
    mode: 'dsl',
    baselineRevision: 'rev-blank',
    schemaHash: null,
    tables: [],
    relations: [],
    positions: {},
    isIntentionalBlank: true,
    isConfirmedBlank: true,
  });
});
