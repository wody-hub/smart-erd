import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownBuffer, serializeMarkdownBuffer } from '../../src/lib/markdown.js';

test('parseMarkdownBuffer 는 잘못된 frontmatter 가 있어도 예외 없이 빈 frontmatter 로 폴백한다', () => {
  const parsed = parseMarkdownBuffer(`---
title: API: Auth
template: technical-spec
---

# Heading

- First item`);

  assert.deepEqual(parsed.frontmatter, {});
  assert.equal(parsed.body, '# Heading\n\n- First item');
  assert.equal(parsed.summaryText, 'First item');
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
