import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  analyzeWordComposition,
  buildWordMatchIndex,
} from '../../src/lib/word-composition.js';
import type { Word } from '../../src/types/dictionary.js';

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

test('whitespace-delimited tokens are composed when each token exists as a whole word', () => {
  const matchIndex = buildWordMatchIndex([
    createWord(1, '등록', 'reg'),
    createWord(2, '일시', 'dt'),
  ]);

  const analysis = analyzeWordComposition('등록 일시', matchIndex);

  assert.equal(analysis.isCompleteMatch, true);
  assert.equal(analysis.isAmbiguous, false);
  assert.equal(analysis.derivedPhysicalName, 'reg_dt');
  assert.deepEqual(
    analysis.matchedWords.map((word) => word.logicalName),
    ['등록', '일시'],
  );
});

test('normalized collisions with different physical names are marked as ambiguous', () => {
  const matchIndex = buildWordMatchIndex([
    createWord(1, '위험성평가', 'risk_assessment'),
    createWord(2, '위험성 평가', 'hazard_eval'),
  ]);

  const analysis = analyzeWordComposition('위험성평가', matchIndex);

  assert.equal(analysis.isCompleteMatch, false);
  assert.equal(analysis.isAmbiguous, true);
  assert.deepEqual(
    [...analysis.ambiguousPhysicalNames].sort(),
    ['hazard_eval', 'risk_assessment'],
  );
});

test('no-space fully unknown input does not suggest creating the whole phrase as a single word', () => {
  const matchIndex = buildWordMatchIndex([createWord(1, '사용자', 'user')]);

  const analysis = analyzeWordComposition('미등록단어', matchIndex);

  assert.equal(analysis.isCompleteMatch, false);
  assert.equal(analysis.isAmbiguous, false);
  assert.deepEqual(analysis.missingSegments, ['미등록단어']);
  assert.deepEqual(analysis.creatableMissingSegments, []);
});

test('single-token input is not split into smaller words without whitespace', () => {
  const matchIndex = buildWordMatchIndex([
    createWord(1, '등록', 'reg'),
    createWord(2, '일시', 'dt'),
    createWord(3, '일', 'day'),
    createWord(4, '시', 'hour'),
  ]);

  const analysis = analyzeWordComposition('등록일시', matchIndex);

  assert.equal(analysis.isCompleteMatch, false);
  assert.equal(analysis.isAmbiguous, false);
  assert.deepEqual(
    analysis.segments.map((segment) => [segment.text, segment.matched]),
    [['등록일시', false]],
  );
  assert.deepEqual(analysis.matchedWords, []);
  assert.deepEqual(analysis.creatableMissingSegments, []);
});

test('single-token exact word match prefers the full word instead of shorter normalized pieces', () => {
  const matchIndex = buildWordMatchIndex([
    createWord(1, '일시', 'dt'),
    createWord(2, '일', 'day'),
    createWord(3, '시', 'hour'),
  ]);

  const analysis = analyzeWordComposition('일시', matchIndex);

  assert.equal(analysis.isCompleteMatch, true);
  assert.equal(analysis.derivedPhysicalName, 'dt');
  assert.deepEqual(
    analysis.matchedWords.map((word) => word.logicalName),
    ['일시'],
  );
});
