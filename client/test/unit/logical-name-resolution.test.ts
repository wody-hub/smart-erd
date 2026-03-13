import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildWordMatchIndex } from '../../src/lib/word-composition.js';
import { resolveLogicalName } from '../../src/lib/logical-name-resolution.js';
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

test('word composition alone derives physical name but does not attach domain until term exists', () => {
  const words = [createWord(1, '사용자', 'user'), createWord(2, '아이디', 'id')];
  const resolution = resolveLogicalName('사용자 아이디', {
    termByName: new Map<string, Term>(),
    domainById: new Map<number, Domain>(),
    wordMatchIndex: buildWordMatchIndex(words),
  });

  assert.equal(resolution.state, 'term-missing');
  assert.equal(resolution.isWordCompleteMatch, true);
  assert.equal(resolution.isRegisteredTerm, false);
  assert.equal(resolution.physicalName, 'user_id');
  assert.equal(resolution.termId, undefined);
  assert.equal(resolution.domainId, null);
  assert.equal(resolution.physicalType, undefined);
});

test('full term registration attaches domain and type after word-based derivation succeeds', () => {
  const words = [createWord(1, '사용자', 'user'), createWord(2, '아이디', 'id')];
  const domains = [createDomain(10, '아이디', 'BIGINT')];
  const terms = [createTerm(100, '사용자 아이디', 'user_id', 10)];
  const resolution = resolveLogicalName('사용자 아이디', {
    termByName: new Map(terms.map((term) => [term.logicalName, term])),
    domainById: new Map(domains.map((domain) => [domain.id, domain])),
    wordMatchIndex: buildWordMatchIndex(words),
  });

  assert.equal(resolution.state, 'registered');
  assert.equal(resolution.isWordCompleteMatch, true);
  assert.equal(resolution.isRegisteredTerm, true);
  assert.equal(resolution.physicalName, 'user_id');
  assert.equal(resolution.termId, 100);
  assert.equal(resolution.domainId, 10);
  assert.equal(resolution.physicalType, 'BIGINT');
});

test('term registration alone is not enough when word composition cannot be resolved', () => {
  const terms = [createTerm(100, '사용자 아이디', 'user_id', null)];
  const resolution = resolveLogicalName('사용자 아이디', {
    termByName: new Map(terms.map((term) => [term.logicalName, term])),
    domainById: new Map<number, Domain>(),
    wordMatchIndex: buildWordMatchIndex([createWord(1, '사용자', 'user')]),
  });

  assert.equal(resolution.state, 'word-missing');
  assert.equal(resolution.isWordCompleteMatch, false);
  assert.equal(resolution.isRegisteredTerm, false);
  assert.equal(resolution.physicalName, '');
  assert.equal(resolution.termId, undefined);
});
