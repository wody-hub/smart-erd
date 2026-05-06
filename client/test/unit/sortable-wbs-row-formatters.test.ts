import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatOptionalPercentage,
  formatPeriod,
  formatVariance,
  formatVarianceDays,
} from '../../src/components/wbs/sortable-wbs-row-formatters.js';
import { getWbsRowSurfaceClasses } from '../../src/components/wbs/sortable-wbs-row-surface.js';

function createT() {
  return ((key: string, options?: Record<string, unknown>) => {
    if (key === 'wbs.field.noMetric') {
      return 'No metric';
    }
    if (key === 'wbs.field.noPeriod') {
      return 'No period';
    }
    if (key === 'wbs.field.startVarianceDays' || key === 'wbs.field.endVarianceDays') {
      return `${String(options?.value)}d`;
    }
    return key;
  }) as never;
}

test('formatPeriod renders full and partial ranges', () => {
  const t = createT();

  assert.equal(formatPeriod('2026-05-01', '2026-05-03', 'en', t), 'May 1, 2026 ~ May 3, 2026');
  assert.equal(formatPeriod('2026-05-01', null, 'en', t), 'May 1, 2026 ~ -');
  assert.equal(formatPeriod(null, '2026-05-03', 'en', t), '- ~ May 3, 2026');
  assert.equal(formatPeriod(null, null, 'en', t), 'No period');
});

test('variance helpers preserve empty and signed values', () => {
  const t = createT();

  assert.equal(formatOptionalPercentage(null, t), 'No metric');
  assert.equal(formatOptionalPercentage(35, t), '35%');
  assert.equal(formatVariance(null, t), 'No metric');
  assert.equal(formatVariance(12, t), '+12%');
  assert.equal(formatVariance(-4, t), '-4%');
  assert.equal(formatVarianceDays(3, 'start', t), '+3d');
  assert.equal(formatVarianceDays(-2, 'end', t), '-2d');
  assert.equal(formatVarianceDays(null, 'start', t), null);
});

test('row surface classes keep selected and authoring affordances intact', () => {
  const selected = getWbsRowSurfaceClasses({
    highlighted: false,
    isDragging: false,
    pageAuthoringMode: false,
    selected: true,
  });
  const authoring = getWbsRowSurfaceClasses({
    highlighted: true,
    isDragging: false,
    pageAuthoringMode: true,
    selected: false,
  });

  assert.match(selected.row, /bg-secondary\/55/);
  assert.equal(selected.denseCell, undefined);
  assert.equal(authoring.compactControl, 'mt-0 h-6 w-6');
  assert.match(authoring.row, /group\/wbs-row/);
  assert.match(authoring.actionCell ?? '', /sticky right-0/);
});
