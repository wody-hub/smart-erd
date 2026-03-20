import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDslCopyTextWithPhysicalNames } from '../../src/lib/dsl-copy-with-physical-names.js';

test('buildDslCopyTextWithPhysicalNames 는 선택이 없으면 전체 DSL에 물리명을 삽입한다', () => {
  const dslText = ['Table User {', '  Id PK', '  UserName', '}'].join('\n');

  const copied = buildDslCopyTextWithPhysicalNames(dslText, [
    { kind: 'table', line: 1, column: 11, logicalName: 'User', physicalName: 'user' },
    {
      kind: 'column',
      tableLogicalName: 'User',
      line: 2,
      column: 5,
      logicalName: 'Id',
      physicalName: 'id',
    },
    {
      kind: 'column',
      tableLogicalName: 'User',
      line: 3,
      column: 11,
      logicalName: 'UserName',
      physicalName: 'user_name',
    },
  ]);

  assert.equal(
    copied,
    ['Table User (user) {', '  Id (id) PK', '  UserName (user_name)', '}'].join('\n'),
  );
});

test('buildDslCopyTextWithPhysicalNames 는 선택 끝 경계 밖의 힌트는 삽입하지 않는다', () => {
  const dslText = ['Table User {', '  Id PK', '  UserName', '}'].join('\n');

  const copied = buildDslCopyTextWithPhysicalNames(
    dslText,
    [
      { kind: 'table', line: 1, column: 11, logicalName: 'User', physicalName: 'user' },
      {
        kind: 'column',
        tableLogicalName: 'User',
        line: 2,
        column: 5,
        logicalName: 'Id',
        physicalName: 'id',
      },
      {
        kind: 'column',
        tableLogicalName: 'User',
        line: 3,
        column: 11,
        logicalName: 'UserName',
        physicalName: 'user_name',
      },
    ],
    [
      {
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 10,
      },
    ],
  );

  assert.equal(copied, ['  Id (id) PK', '  UserNam'].join('\n'));
});

test('buildDslCopyTextWithPhysicalNames 는 멀티 셀렉션을 순서대로 이어붙인다', () => {
  const dslText = ['Table User {', '  Id PK', '  UserName', '}'].join('\n');

  const copied = buildDslCopyTextWithPhysicalNames(
    dslText,
    [
      { kind: 'table', line: 1, column: 11, logicalName: 'User', physicalName: 'user' },
      {
        kind: 'column',
        tableLogicalName: 'User',
        line: 3,
        column: 11,
        logicalName: 'UserName',
        physicalName: 'user_name',
      },
    ],
    [
      {
        startLineNumber: 3,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 11,
      },
      {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 13,
      },
    ],
  );

  assert.equal(copied, ['Table User (user) {', '  UserName (user_name)'].join('\n'));
});

test('buildDslCopyTextWithPhysicalNames 는 같은 줄의 여러 힌트를 offset 꼬임 없이 삽입한다', () => {
  const dslText = 'Table User Account';

  const copied = buildDslCopyTextWithPhysicalNames(dslText, [
    { kind: 'table', line: 1, column: 11, logicalName: 'User', physicalName: 'user' },
    {
      kind: 'table',
      line: 1,
      column: 19,
      logicalName: 'Account',
      physicalName: 'account',
    },
  ]);

  assert.equal(copied, 'Table User (user) Account (account)');
});
