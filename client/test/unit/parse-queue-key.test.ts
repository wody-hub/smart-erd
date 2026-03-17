import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildParseQueueKey } from '../../src/lib/parse-queue-key.js';

test('buildParseQueueKey 는 동일 입력 조합에 대해 같은 키를 만든다', () => {
  assert.equal(buildParseQueueKey('postgresql', 'create table a(id bigint);'), buildParseQueueKey('postgresql', 'create table a(id bigint);'));
});

test('buildParseQueueKey 는 파싱 옵션이 다르면 다른 키를 만든다', () => {
  assert.notEqual(
    buildParseQueueKey('postgresql', 'create table a(id bigint);'),
    buildParseQueueKey('mysql', 'create table a(id bigint);'),
  );
});

test('buildParseQueueKey 는 단일 텍스트 입력도 안정적으로 직렬화한다', () => {
  assert.equal(buildParseQueueKey('Table 코드'), JSON.stringify(['Table 코드']));
});
