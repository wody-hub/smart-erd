import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownBuffer, serializeMarkdownBuffer } from '../../src/lib/markdown.js';

test('parseMarkdownBuffer 는 잘못된 frontmatter 가 있어도 예외 없이 빈 frontmatter 로 폴백하고 frontmatterValid=false 를 반환한다', () => {
  const parsed = parseMarkdownBuffer(`---
title: API: Auth
template: technical-spec
---

# Heading

- First item`);

  assert.deepEqual(parsed.frontmatter, {});
  assert.equal(parsed.frontmatterValid, false);
  assert.equal(parsed.frontmatterText, 'title: API: Auth\ntemplate: technical-spec');
  assert.equal(parsed.body, '# Heading\n\n- First item');
  assert.equal(parsed.summaryText, 'First item');
});

test('parseMarkdownBuffer 는 정상 frontmatter 에서 frontmatterValid=true 를 반환한다', () => {
  const parsed = parseMarkdownBuffer(`---
title: 정상 문서
template: technical-spec
---

# 내용`);

  assert.equal(parsed.frontmatterValid, true);
  assert.equal(parsed.frontmatter.title, '정상 문서');
  assert.equal(parsed.frontmatter.template, 'technical-spec');
});

test('parseMarkdownBuffer 는 frontmatter 없는 문서에서 frontmatterValid=true 를 반환한다', () => {
  const parsed = parseMarkdownBuffer('# 제목\n\n본문');

  assert.equal(parsed.frontmatterValid, true);
  assert.equal(parsed.frontmatterText, null);
  assert.deepEqual(parsed.frontmatter, {});
});

test('parseMarkdownBuffer 는 빈 YAML 매핑을 valid frontmatter 로 처리한다', () => {
  const parsed = parseMarkdownBuffer(`---
---

# 내용`);

  assert.equal(parsed.frontmatterValid, true);
  assert.deepEqual(parsed.frontmatter, {});
});

test('parseMarkdownBuffer 는 YAML null 값을 invalid frontmatter 로 처리한다', () => {
  const parsed = parseMarkdownBuffer(`---
null
---

# 내용`);

  assert.equal(parsed.frontmatterValid, false);
  assert.deepEqual(parsed.frontmatter, {});
});

test('parseMarkdownBuffer 는 YAML date scalar 를 timestamp 로 승격하지 않고 YYYY-MM-DD 로 유지한다', () => {
  const parsed = parseMarkdownBuffer(`---
title: Loop
date: 2026-04-01
---

# Heading`);

  assert.equal(parsed.frontmatter.date, '2026-04-01');
  assert.equal(
    serializeMarkdownBuffer(parsed.frontmatter, parsed.body),
    `---
title: Loop
date: '2026-04-01'
---

# Heading`,
  );
});
