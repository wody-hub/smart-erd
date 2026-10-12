import test from 'node:test';
import assert from 'node:assert/strict';

import { ROUTES } from '../../src/constants/routes.js';
import { STORAGE_KEYS } from '../../src/constants/storage.js';

test('ROUTES exposes public ERD local path', () => {
  assert.equal(ROUTES.ERD_LOCAL, '/erd-local');
});

test('STORAGE_KEYS exposes ERD local draft key', () => {
  assert.equal(STORAGE_KEYS.ERD_LOCAL_DRAFT, 'smart-erd-erd-local-draft');
});
