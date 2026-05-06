import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDefaultE2EEndpoints } from '../../e2e/shared/diagram-e2e.js';

test('resolveDefaultE2EEndpoints prefers the dev runtime when only 4503/9503 are reachable', () => {
  const openPorts = new Set([4503, 9503]);

  assert.deepEqual(resolveDefaultE2EEndpoints((port) => openPorts.has(port)), {
    baseUrl: 'http://localhost:4503',
    apiBaseUrl: 'http://localhost:9503/api',
  });
});

test('resolveDefaultE2EEndpoints preserves the test fallback when no known runtime is reachable', () => {
  assert.deepEqual(resolveDefaultE2EEndpoints(() => false), {
    baseUrl: 'http://localhost:4502',
    apiBaseUrl: 'http://localhost:9502/api',
  });
});
