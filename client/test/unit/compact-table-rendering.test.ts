import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPACT_TABLE_RENDERING_NODE_LIMIT,
  resolveCompactTableRenderingMode,
} from '../../src/components/erd/CompactTableRenderingContext.js';

test('resolveCompactTableRenderingMode 는 대형 ERD 와 낮은 zoom 에서도 compact 렌더링을 끈다', () => {
  assert.equal(
    resolveCompactTableRenderingMode(COMPACT_TABLE_RENDERING_NODE_LIMIT + 1, 0.4),
    'off',
  );
});
