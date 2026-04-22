import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampStaffingMonthWindowStart,
  getVisibleStaffingMonths,
} from '../../src/components/staffing/staffing-matrix-window.js';

function buildMonths(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const year = 2024 + Math.floor(index / 12);
    const month = String((index % 12) + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
}

test('getVisibleStaffingMonths returns all months when month count is below threshold window', () => {
  const months = buildMonths(10);

  const visible = getVisibleStaffingMonths(months, 0, 12);

  assert.deepEqual(visible, months);
});

test('getVisibleStaffingMonths returns first, middle, and last windows for 36 months', () => {
  const months = buildMonths(36);

  assert.deepEqual(getVisibleStaffingMonths(months, 0, 12), months.slice(0, 12));
  assert.deepEqual(getVisibleStaffingMonths(months, 12, 12), months.slice(12, 24));
  assert.deepEqual(getVisibleStaffingMonths(months, 24, 12), months.slice(24, 36));
});

test('clampStaffingMonthWindowStart clamps requested indexes to both bounds', () => {
  const months = buildMonths(36);

  assert.equal(clampStaffingMonthWindowStart(months, -5, 12), 0);
  assert.equal(clampStaffingMonthWindowStart(months, 999, 12), 24);
});

test('empty months return an empty visible window', () => {
  assert.equal(clampStaffingMonthWindowStart([], 10, 12), 0);
  assert.deepEqual(getVisibleStaffingMonths([], 0, 12), []);
});
