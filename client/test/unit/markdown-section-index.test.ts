import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSectionBoundaries,
  findAffectedSection,
} from '../../src/lib/markdown-section-index.js';

// --- computeSectionBoundaries ---

test('computeSectionBoundaries: 빈 body 는 root 섹션 하나를 반환한다', () => {
  const result = computeSectionBoundaries('');
  assert.deepEqual(result, [
    { id: 'root', level: 0, startOffset: 0, endOffset: 0, text: '' },
  ]);
});

test('computeSectionBoundaries: heading 없는 body 는 root 섹션 하나 (endOffset = body.length)', () => {
  const result = computeSectionBoundaries('hello world');
  assert.deepEqual(result, [
    { id: 'root', level: 0, startOffset: 0, endOffset: 11, text: '' },
  ]);
});

test('computeSectionBoundaries: 단일 heading (heading 이전 content 없음) 은 root 섹션 없이 heading 섹션만 반환한다', () => {
  const result = computeSectionBoundaries('# Hello\n\nContent');
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, 'hello');
  assert.equal(result[0]!.level, 1);
  assert.equal(result[0]!.startOffset, 0);
  assert.equal(result[0]!.endOffset, 16); // '# Hello\n\nContent'.length === 16
  assert.equal(result[0]!.text, 'Hello');
});

test('computeSectionBoundaries: heading 이전 content 가 있으면 root 섹션 + heading 섹션을 반환한다', () => {
  const body = 'Intro\n\n# API\n\nContent';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'root');
  assert.equal(result[0]!.startOffset, 0);
  assert.equal(result[0]!.endOffset, 7);
  assert.equal(result[1]!.id, 'api');
  assert.equal(result[1]!.startOffset, 7);
  assert.equal(result[1]!.endOffset, body.length);
});

test('computeSectionBoundaries: 두 개 heading 은 두 개 섹션을 반환한다', () => {
  const body = '# A\n\ntext\n\n# B\n\nother';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'a');
  assert.equal(result[0]!.level, 1);
  assert.equal(result[0]!.startOffset, 0);
  assert.equal(result[0]!.endOffset, 11);
  assert.equal(result[1]!.id, 'b');
  assert.equal(result[1]!.level, 1);
  assert.equal(result[1]!.startOffset, 11);
  assert.equal(result[1]!.endOffset, body.length);
});

test('computeSectionBoundaries: slug 충돌 시 -1 접미사를 추가한다', () => {
  const body = '# API\n\nfirst\n\n# API\n\nsecond';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'api');
  assert.equal(result[1]!.id, 'api-1');
});

test('computeSectionBoundaries: 빈 slug (특수문자만인 heading) 은 section 기본값을 사용한다', () => {
  const body = '# ***\n\ncontent';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, 'section');
});

test('computeSectionBoundaries: 한글 heading slug 를 올바르게 생성한다', () => {
  const body = '# API 설계\n\n내용';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, 'api-설계');
  assert.equal(result[0]!.text, 'API 설계');
});

test('computeSectionBoundaries: 다양한 heading level 을 올바르게 처리한다', () => {
  const body = '# H1\n\n## H2\n\n### H3\n\ntext';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 3);
  assert.equal(result[0]!.level, 1);
  assert.equal(result[1]!.level, 2);
  assert.equal(result[2]!.level, 3);
});

// --- findAffectedSection ---

test('findAffectedSection: 단일 section 내 변경은 해당 section id 를 반환한다', () => {
  const body = '# A\n\ntext\n\n# B\n\nother';
  const boundaries = computeSectionBoundaries(body);
  // offset 5 ~ 8 는 첫 번째 section 'a' 내에 있다 (startOffset: 0, endOffset: 11)
  const result = findAffectedSection(boundaries, 5, 8);
  assert.equal(result, 'a');
});

test('findAffectedSection: 경계를 넘는 변경은 null 을 반환한다', () => {
  const body = '# A\n\ntext\n\n# B\n\nother';
  const boundaries = computeSectionBoundaries(body);
  // offset 3 ~ 15 는 두 section 에 걸친다
  const result = findAffectedSection(boundaries, 3, 15);
  assert.equal(result, null);
});

test('findAffectedSection: 빈 변경 (start === end) 은 해당 section id 를 반환한다', () => {
  const body = '# A\n\ntext\n\n# B\n\nother';
  const boundaries = computeSectionBoundaries(body);
  const result = findAffectedSection(boundaries, 5, 5);
  assert.equal(result, 'a');
});

test('findAffectedSection: section 끝에 위치한 빈 변경은 해당 section id 를 반환한다', () => {
  const body = '# A\n\ntext\n\n# B\n\nother';
  const boundaries = computeSectionBoundaries(body);
  // offset 11 은 두 번째 section 'b' 의 startOffset 이자 첫 번째 section 의 endOffset
  // 빈 변경이므로 경계 위에서는 다음 section 에 속한다
  const result = findAffectedSection(boundaries, 11, 11);
  assert.equal(result, 'b');
});

// --- fenced code block 내 heading 오탐 방지 ---

test('computeSectionBoundaries: fenced code block 내 # 은 heading 이 아니다', () => {
  const body = '# Real\n\n```\n# Not a heading\n```\n\n# Another';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'real');
  assert.equal(result[1]!.id, 'another');
});

test('computeSectionBoundaries: tildes fenced code block 내 # 무시', () => {
  const body = '~~~\n# Ignored\n~~~\n\n# Visible';
  const result = computeSectionBoundaries(body);
  // code fence 앞에 heading 이 없으므로 root + visible 2개 섹션
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'root');
  assert.equal(result[1]!.id, 'visible');
});

test('computeSectionBoundaries: unclosed fenced code block 은 나머지 전체를 code block 으로 처리', () => {
  const body = '# Before\n\n```\n# Inside unclosed';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, 'before');
});

test('computeSectionBoundaries: info string 이 있는 fenced code block 내 # 무시', () => {
  const body = '# Real\n\n```js\n# comment in JS\n```\n\n# End';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'real');
  assert.equal(result[1]!.id, 'end');
});

test('computeSectionBoundaries: 4+ backtick 중첩 fenced code block 은 outer 만 인식', () => {
  const body = '# Top\n\n````\n```\n# Inner\n```\n````\n\n# Bottom';
  const result = computeSectionBoundaries(body);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'top');
  assert.equal(result[1]!.id, 'bottom');
});
