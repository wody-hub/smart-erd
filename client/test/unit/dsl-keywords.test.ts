import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  DSL_TABLE_AFTER_REGEX,
  DSL_TABLE_TERM_CAPTURE_REGEX,
  DSL_DOMAIN_CONTEXT_REGEX,
  DSL_DOMAIN_CAPTURE_REGEX,
  DSL_EXPLICIT_TYPE_CONTEXT_REGEX,
  DSL_FK_CONTEXT_REGEX,
  DSL_FK_CAPTURE_REGEX,
  DSL_BLOCK_TERM_CAPTURE_REGEX,
} from '../../src/lib/dsl-keywords.js';

test('TABLE 컨텍스트 정규식은 공백 포함 논리명을 허용하고 블록 시작은 제외한다', () => {
  assert.equal(DSL_TABLE_AFTER_REGEX.test('Table 사용자 이름'), true);
  assert.equal(DSL_TABLE_AFTER_REGEX.test('Table 사용자 이름 {'), false);
  assert.equal(DSL_TABLE_TERM_CAPTURE_REGEX.exec('Table 사용자 이름')?.[1], '사용자 이름');
});

test('DOMAIN 컨텍스트 정규식은 단일 콜론만 캡처하고 이중 콜론은 제외한다', () => {
  const domainLine = "  사용자 이름 : '한글 이름'";
  assert.equal(DSL_DOMAIN_CONTEXT_REGEX.test(domainLine), true);
  assert.equal(DSL_EXPLICIT_TYPE_CONTEXT_REGEX.test(domainLine), false);
  assert.equal(DSL_DOMAIN_CAPTURE_REGEX.exec(domainLine)?.[2], "'한글 이름'");

  const typeLine = '  사용자 이름 :: VARCHAR(100)';
  assert.equal(DSL_EXPLICIT_TYPE_CONTEXT_REGEX.test(typeLine), true);
});

test('FK 컨텍스트 정규식은 공백 포함 참조명을 캡처한다', () => {
  const fkLine = '  사용자 ID > 상위 사용자.상위 사용자 ID : 숫자';
  assert.equal(DSL_FK_CONTEXT_REGEX.test(fkLine), true);
  assert.equal(DSL_FK_CAPTURE_REGEX.exec(fkLine)?.[1], '상위 사용자.상위 사용자 ID : 숫자');
});

test('블록 내부 용어 캡처 정규식은 컬럼 논리명 구간만 허용한다', () => {
  assert.equal(DSL_BLOCK_TERM_CAPTURE_REGEX.exec('  사용자 이름')?.[1], '사용자 이름');
  assert.equal(DSL_BLOCK_TERM_CAPTURE_REGEX.test('  사용자 이름 : 문자'), false);
  assert.equal(DSL_BLOCK_TERM_CAPTURE_REGEX.test('  사용자 이름 > 사용자.ID'), false);
});
