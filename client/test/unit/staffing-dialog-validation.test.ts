import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasAnyActualInput,
  validateActualInput,
} from '../../src/components/staffing/staffing-dialog-validation.js';

test('validateActualInput rejects participation-only actual input with actualDatePair error', () => {
  const error = validateActualInput({
    actualStartDate: '',
    actualEndDate: '',
    actualParticipationRate: '50',
  });

  assert.equal(error, 'actualDatePair');
});

test('validateActualInput allows all actual fields to remain empty', () => {
  const error = validateActualInput({
    actualStartDate: '',
    actualEndDate: '',
    actualParticipationRate: '',
  });

  assert.equal(error, null);
});

test('hasAnyActualInput detects any non-empty actual field', () => {
  assert.equal(
    hasAnyActualInput({
      actualStartDate: '',
      actualEndDate: '',
      actualParticipationRate: '',
    }),
    false,
  );

  assert.equal(
    hasAnyActualInput({
      actualStartDate: '',
      actualEndDate: '2026-04-01',
      actualParticipationRate: '',
    }),
    true,
  );
});
