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

test('backtracking finds a valid composition even when the longest first match fails', () => {
  const matchIndex = buildWordMatchIndex([
    createWord(1, '가나', 'ga_na'),
    createWord(2, '가', 'ga'),
    createWord(3, '나다', 'na_da'),
  ]);

  const analysis = analyzeWordComposition('가나다', matchIndex);

  assert.equal(analysis.isCompleteMatch, true);
  assert.equal(analysis.isAmbiguous, false);
  assert.equal(analysis.derivedPhysicalName, 'ga_na_da');
  assert.deepEqual(
    analysis.matchedWords.map((word) => word.logicalName),
    ['가', '나다'],
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

test('partial no-space matches expose only the missing suffix as creatable', () => {
  const matchIndex = buildWordMatchIndex([createWord(1, '사용자', 'user')]);

  const analysis = analyzeWordComposition('사용자식별자', matchIndex);

  assert.equal(analysis.isCompleteMatch, false);
  assert.equal(analysis.isAmbiguous, false);
  assert.deepEqual(
    analysis.segments.map((segment) => [segment.text, segment.matched]),
    [
      ['사용자', true],
      ['식별자', false],
    ],
  );
  assert.deepEqual(analysis.creatableMissingSegments, ['식별자']);
});
