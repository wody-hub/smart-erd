import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveCompactTableRenderingMode,
  type CompactTableRenderingMode,
} from '@/components/erd/CompactTableRenderingContext';

test('keeps table rendering fully detailed regardless of diagram size and zoom', () => {
  const cases: Array<{
    nodeCount: number;
    zoom: number;
    expected: CompactTableRenderingMode;
  }> = [
    { nodeCount: 20, zoom: 0.4, expected: 'off' },
    { nodeCount: 81, zoom: 0.8, expected: 'off' },
    { nodeCount: 500, zoom: 0.55, expected: 'off' },
    { nodeCount: 500, zoom: 0.2, expected: 'off' },
  ];

  for (const { nodeCount, zoom, expected } of cases) {
    assert.equal(resolveCompactTableRenderingMode(nodeCount, zoom), expected);
  }
});
