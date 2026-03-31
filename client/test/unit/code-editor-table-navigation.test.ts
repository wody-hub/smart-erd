import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCodeEditorNavigableTables,
  resolveCodeEditorNavigableTableByLine,
  resolveCodeEditorNavigableTableByRequest,
} from '../../src/lib/code-editor-table-navigation.js';

test('buildCodeEditorNavigableTables 는 테이블과 라인 범위를 순서대로 묶는다', () => {
  const tables = [
    { name: 'users', logicalTableName: '사용자' },
    { name: 'orders', logicalTableName: '주문' },
  ];
  const ranges = [
    { tableKey: 'table-lock-users', startLine: 1, endLine: 4 },
    { tableKey: 'table-lock-orders', startLine: 6, endLine: 9 },
  ];

  assert.deepEqual(buildCodeEditorNavigableTables(tables, ranges), [
    {
      tableKey: 'table-lock-users',
      physicalName: 'users',
      logicalName: '사용자',
      startLine: 1,
      endLine: 4,
    },
    {
      tableKey: 'table-lock-orders',
      physicalName: 'orders',
      logicalName: '주문',
      startLine: 6,
      endLine: 9,
    },
  ]);
});

test('resolveCodeEditorNavigableTableByLine 는 해당 라인의 테이블을 반환한다', () => {
  const navigableTables = [
    {
      tableKey: 'table-lock-users',
      physicalName: 'users',
      logicalName: '사용자',
      startLine: 1,
      endLine: 4,
    },
    {
      tableKey: 'table-lock-orders',
      physicalName: 'orders',
      logicalName: '주문',
      startLine: 6,
      endLine: 9,
    },
  ];

  assert.equal(
    resolveCodeEditorNavigableTableByLine(navigableTables, 7)?.physicalName,
    'orders',
  );
  assert.equal(resolveCodeEditorNavigableTableByLine(navigableTables, 5), null);
});

test('resolveCodeEditorNavigableTableByRequest 는 물리명/논리명으로 reveal 대상을 찾는다', () => {
  const navigableTables = [
    {
      tableKey: 'table-lock-users',
      physicalName: 'users',
      logicalName: '사용자',
      startLine: 1,
      endLine: 4,
    },
    {
      tableKey: 'table-lock-orders',
      physicalName: 'orders',
      logicalName: '주문',
      startLine: 6,
      endLine: 9,
    },
  ];

  assert.equal(
    resolveCodeEditorNavigableTableByRequest(navigableTables, {
      requestId: 1,
      physicalName: 'orders',
      logicalName: '주문',
    })?.startLine,
    6,
  );
});

test('resolveCodeEditorNavigableTableByRequest 는 tableKey 가 있으면 우선 매칭한다', () => {
  const navigableTables = [
    {
      tableKey: 'table-lock-users',
      physicalName: 'users',
      logicalName: '사용자',
      startLine: 1,
      endLine: 4,
    },
    {
      tableKey: 'table-lock-users-v2',
      physicalName: 'users',
      logicalName: '사용자',
      startLine: 10,
      endLine: 14,
    },
  ];

  assert.equal(
    resolveCodeEditorNavigableTableByRequest(navigableTables, {
      requestId: 2,
      tableKey: 'table-lock-users-v2',
      physicalName: 'users',
      logicalName: '사용자',
    })?.startLine,
    10,
  );
});
