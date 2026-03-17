import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildTermAssistInsertText,
  extractColumnTermAssistContext,
  filterAssistItemsForTrigger,
  sortAssistItems,
  type AssistPopupItemCategory,
} from '../../src/lib/dsl-assist.js';

interface MockAssistItem {
  id: string;
  category: AssistPopupItemCategory;
}

test('sortAssistItems 는 기존 term/domain 후보를 register 보다 앞에 둔다', () => {
  const sorted = sortAssistItems<MockAssistItem>([
    { id: 'register', category: 'register' },
    { id: 'type', category: 'type' },
    { id: 'term', category: 'term' },
    { id: 'domain', category: 'domain' },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['term', 'domain', 'register', 'type'],
  );
});

test('filterAssistItemsForTrigger 는 자동 트리거에서 noisy한 보조 항목을 숨긴다', () => {
  const filtered = filterAssistItemsForTrigger<MockAssistItem>(
    [
      { id: 'term', category: 'term' },
      { id: 'domain', category: 'domain' },
      { id: 'register', category: 'register' },
      { id: 'type', category: 'type' },
      { id: 'fk', category: 'fk' },
    ],
    'typing',
  );

  assert.deepEqual(
    filtered.map((item) => item.id),
    ['term', 'domain', 'register'],
  );
});

test('filterAssistItemsForTrigger 는 manual 트리거에서 전체 항목을 유지한다', () => {
  const items = [
    { id: 'term', category: 'term' as const },
    { id: 'type', category: 'type' as const },
  ];

  assert.deepEqual(filterAssistItemsForTrigger(items, 'manual'), items);
});

test('buildTermAssistInsertText 는 컬럼 컨텍스트에서 연결 도메인을 즉시 반영한다', () => {
  assert.equal(
    buildTermAssistInsertText('코드 그룹 아이디', '코드그룹아이디', true),
    "'코드 그룹 아이디' :코드그룹아이디",
  );
  assert.equal(buildTermAssistInsertText('코드 그룹', '코드그룹', false), "'코드 그룹'");
});

test('extractColumnTermAssistContext 는 도메인/옵션/FK/comment 를 제외한 논리명 core를 추출한다', () => {
  assert.deepEqual(
    extractColumnTermAssistContext("  '코드 그룹 아이디' :코드그룹아이디 [NN] > 코드.아이디 // note"),
    {
      logicalName: '코드 그룹 아이디',
      replaceStartColumn: 3,
      replaceEndColumn: 23,
    },
  );
});
