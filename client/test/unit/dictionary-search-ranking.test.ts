import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rankDictionarySearchResults } from '../../src/lib/dictionary-search-ranking.js';

test('rankDictionarySearchResults 는 논리명 매칭 결과를 다른 필드 매칭보다 앞에 둔다', () => {
  const results = rankDictionarySearchResults(
    [
      { logicalName: '고객 번호', physicalName: 'customer_no', description: null },
      { logicalName: '주문', physicalName: 'customer_order', description: null },
      { logicalName: '메모', physicalName: 'memo', description: '고객 메모' },
    ],
    '고객',
    (entry) => [entry.physicalName, entry.description],
  );

  assert.deepEqual(
    results.map((entry) => entry.logicalName),
    ['고객 번호', '메모', '주문'],
  );
});

test('rankDictionarySearchResults 는 같은 논리명 매칭 그룹 안에서 더 이른 위치를 우선한다', () => {
  const results = rankDictionarySearchResults(
    [
      { logicalName: '번호 고객', physicalName: 'customer_no' },
      { logicalName: '고객 번호', physicalName: 'customer_number' },
      { logicalName: '주문 고객 상태', physicalName: 'order_customer_status' },
    ],
    '고객',
    (entry) => [entry.physicalName],
  );

  assert.deepEqual(
    results.map((entry) => entry.logicalName),
    ['고객 번호', '번호 고객', '주문 고객 상태'],
  );
});
