import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDslPhysicalNameHints } from '../../src/lib/dsl-physical-name-hints.js';
import type { DslPhysicalNameHint } from '../../src/lib/dsl-parser.js';

const parsedHints: DslPhysicalNameHint[] = [
  {
    kind: 'table',
    line: 1,
    column: 10,
    logicalName: '사용자',
    physicalName: 'user_from_parser',
  },
  {
    kind: 'column',
    tableLogicalName: '사용자',
    line: 2,
    column: 12,
    logicalName: '사용자 아이디',
    physicalName: 'user_id_from_parser',
  },
];

test('buildDslPhysicalNameHints 는 ERD의 유일 물리명을 우선 사용한다', () => {
  const hints = buildDslPhysicalNameHints(parsedHints, [
    'table\t사용자\tuser',
    'column\t사용자\t사용자 아이디\tuser_id',
  ]);

  assert.deepEqual(
    hints.map((hint) => hint.physicalName),
    ['user', 'user_id'],
  );
});

test('buildDslPhysicalNameHints 는 ambiguous 한 ERD key 에서 parser fallback 을 사용한다', () => {
  const hints = buildDslPhysicalNameHints(parsedHints, [
    'table\t사용자\tuser_a',
    'table\t사용자\tuser_b',
    'column\t사용자\t사용자 아이디\tuser_id_a',
    'column\t사용자\t사용자 아이디\tuser_id_b',
  ]);

  assert.deepEqual(
    hints.map((hint) => hint.physicalName),
    ['user_from_parser', 'user_id_from_parser'],
  );
});

test('buildDslPhysicalNameHints 는 최종 물리명이 논리명과 같으면 힌트를 숨긴다', () => {
  const hints = buildDslPhysicalNameHints(
    [
      {
        kind: 'table',
        line: 1,
        column: 10,
        logicalName: '사용자',
        physicalName: '사용자',
      },
    ],
    [],
  );

  assert.equal(hints.length, 0);
});
