import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyQuickTermToDslLine } from '../../src/lib/dsl-line-edit.js';

test('applyQuickTermToDslLine 는 논리명과 도메인을 함께 반영하면서 FK/옵션/주석을 보존한다', () => {
  const line = "  '대상번호' > 주문.주문번호 ::VARCHAR(30) [NN] // note";

  const updated = applyQuickTermToDslLine(line, '대상 번호', '공통번호');

  assert.equal(updated, "  '대상 번호' > 주문.주문번호 :공통번호 [NN] // note");
});

test('applyQuickTermToDslLine 는 도메인이 없으면 기존 타입/옵션을 유지한 채 논리명만 바꾼다', () => {
  const line = "  legacy_code ::VARCHAR(30) [NN]";

  const updated = applyQuickTermToDslLine(line, '신규 코드');

  assert.equal(updated, "  '신규 코드' ::VARCHAR(30) [NN]");
});

test('applyQuickTermToDslLine 는 Table 선언과 주석 줄은 건드리지 않는다', () => {
  assert.equal(applyQuickTermToDslLine('Table 코드 {', '코드'), 'Table 코드 {');
  assert.equal(
    applyQuickTermToDslLine('  // temporary comment', '신규 코드', '공통번호'),
    '  // temporary comment',
  );
});
