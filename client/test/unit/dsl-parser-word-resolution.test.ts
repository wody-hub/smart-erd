import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildWordMatchIndex } from '../../src/lib/word-composition.js';
import { parseDsl } from '../../src/lib/dsl-parser.js';
import type { Domain, Term, Word } from '../../src/types/dictionary.js';

function createWord(id: number, logicalName: string, physicalName: string): Word {
  return {
    id,
    logicalName,
    physicalName,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
  };
}

function createDomain(id: number, logicalName: string, physicalType: string): Domain {
  return {
    id,
    logicalName,
    physicalType,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
  };
}

function createTerm(
  id: number,
  logicalName: string,
  physicalName: string,
  domainId: number | null,
): Term {
  return {
    id,
    logicalName,
    physicalName,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    domainId,
    domainLogicalName: domainId != null ? '아이디' : null,
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
  };
}

test('DSL parser derives physical names from words even when the full term is not registered', () => {
  const words = [createWord(1, '사용자', 'user'), createWord(2, '아이디', 'id')];
  const parsed = parseDsl('Table 사용자 {\n  사용자 아이디\n}', {
    termByName: new Map<string, Term>(),
    domainByName: new Map<string, Domain>(),
    domainById: new Map<number, Domain>(),
    wordMatchIndex: buildWordMatchIndex(words),
  });

  assert.equal(parsed.result.tables.length, 1);
  assert.equal(parsed.result.tables[0]?.name, 'user');
  assert.equal(parsed.result.tables[0]?.columns[0]?.name, 'user_id');
  assert.equal(parsed.result.tables[0]?.columns[0]?.termId, undefined);
  assert.equal(
    parsed.diagnostics.filter((diagnostic) => diagnostic.messageKey === 'erd.dsl.error.unknownTerm')
      .length,
    2,
  );
});

test('DSL parser attaches domain metadata only after the full term is registered', () => {
  const words = [createWord(1, '사용자', 'user'), createWord(2, '아이디', 'id')];
  const domains = [createDomain(10, '아이디', 'BIGINT')];
  const terms = [createTerm(100, '사용자 아이디', 'user_id', 10)];
  const parsed = parseDsl('Table 사용자 {\n  사용자 아이디\n}', {
    termByName: new Map<string, Term>(terms.map((term) => [term.logicalName, term])),
    domainByName: new Map<string, Domain>(domains.map((domain) => [domain.logicalName, domain])),
    domainById: new Map<number, Domain>(domains.map((domain) => [domain.id, domain])),
    wordMatchIndex: buildWordMatchIndex(words),
  });

  assert.equal(parsed.result.tables[0]?.columns[0]?.name, 'user_id');
  assert.equal(parsed.result.tables[0]?.columns[0]?.termId, 100);
  assert.equal(parsed.result.tables[0]?.columns[0]?.domainId, 10);
  assert.equal(parsed.result.tables[0]?.columns[0]?.type, 'BIGINT');
});

test('DSL parser exposes physical name hints for resolved table and column names', () => {
  const words = [
    createWord(1, '사용자', 'user'),
    createWord(2, '아이디', 'id'),
  ];
  const parsed = parseDsl('Table 사용자 {\n  사용자 아이디\n}', {
    termByName: new Map<string, Term>(),
    domainByName: new Map<string, Domain>(),
    domainById: new Map<number, Domain>(),
    wordMatchIndex: buildWordMatchIndex(words),
  });

  assert.deepEqual(
    parsed.physicalNameHints.map((hint) => ({
      kind: hint.kind,
      line: hint.line,
      logicalName: hint.logicalName,
      physicalName: hint.physicalName,
    })),
    [
      {
        kind: 'table',
        line: 1,
        logicalName: '사용자',
        physicalName: 'user',
      },
      {
        kind: 'column',
        line: 2,
        logicalName: '사용자 아이디',
        physicalName: 'user_id',
      },
    ],
  );
});
