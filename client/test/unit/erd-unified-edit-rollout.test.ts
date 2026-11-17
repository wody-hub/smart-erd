import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveErdUnifiedEditRollout } from '../../src/lib/erd-unified-edit-rollout.js';

test('rollout defaults off and requires an exact allowlisted diagram', () => {
  assert.equal(resolveErdUnifiedEditRollout('42', {}), 'off');
  const env = {
    VITE_ERD_UNIFIED_EDIT_MODE: 'internal',
    VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS: ' 42, 7,42 ',
  };
  assert.equal(resolveErdUnifiedEditRollout('42', env), 'internal');
  assert.equal(resolveErdUnifiedEditRollout('4', env), 'off');
  assert.equal(resolveErdUnifiedEditRollout(undefined, env), 'off');
  assert.equal(
    resolveErdUnifiedEditRollout('42', { ...env, VITE_ERD_UNIFIED_EDIT_MODE: 'off' }),
    'off',
  );
  assert.equal(
    resolveErdUnifiedEditRollout('42', { ...env, VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS: '' }),
    'off',
  );
  assert.equal(
    resolveErdUnifiedEditRollout('42', { ...env, VITE_ERD_UNIFIED_EDIT_MODE: 'true' }),
    'off',
  );
});

test('all enables isolated dev/E2E diagrams only with internal mode', () => {
  assert.equal(
    resolveErdUnifiedEditRollout('arbitrary', {
      VITE_ERD_UNIFIED_EDIT_MODE: 'internal',
      VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS: 'all',
    }),
    'internal',
  );
  assert.equal(
    resolveErdUnifiedEditRollout('42', { VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS: 'all' }),
    'off',
  );
});
