import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateOnly } from '../../src/components/gantt/gantt-date-utils.js';
import { resolveWbsDateRangeUpdate } from '../../src/components/gantt/gantt-update-guards.js';

test('resolveWbsDateRangeUpdate rejects non-date updates', () => {
  const decision = resolveWbsDateRangeUpdate({
    start: '2026-04-10',
    end: '2026-04-12',
    originalStartDate: '2026-04-10',
    originalEndDate: '2026-04-12',
  });

  assert.equal(decision, null);
});

test('resolveWbsDateRangeUpdate rejects unchanged date range (blocks progress-only edits)', () => {
  const decision = resolveWbsDateRangeUpdate({
    start: parseDateOnly('2026-04-10'),
    end: parseDateOnly('2026-04-12'),
    originalStartDate: '2026-04-10',
    originalEndDate: '2026-04-12',
  });

  assert.equal(decision, null);
});

test('resolveWbsDateRangeUpdate accepts changed date range', () => {
  const decision = resolveWbsDateRangeUpdate({
    start: parseDateOnly('2026-04-11'),
    end: parseDateOnly('2026-04-15'),
    originalStartDate: '2026-04-10',
    originalEndDate: '2026-04-12',
  });

  assert.deepEqual(decision, {
    startDate: '2026-04-11',
    endDate: '2026-04-15',
  });
});
