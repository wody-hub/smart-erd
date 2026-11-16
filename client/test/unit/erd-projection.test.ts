import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mergeProjectedEntitiesById } from '../../src/lib/erd-projection.js';

test('mergeProjectedEntitiesById replaces one of many entities and keeps every other reference ordered', () => {
  const current = Array.from({ length: 200 }, (_, index) => ({
    id: `table-${index}`,
    data: { label: `Table ${index}` },
  }));
  const renamed = { ...current[87], data: { label: 'Renamed table' } };

  const next = mergeProjectedEntitiesById(current, new Set([renamed.id]), [renamed]);

  assert.equal(next.length, current.length);
  assert.deepEqual(
    next.map((node) => node.id),
    current.map((node) => node.id),
  );
  assert.equal(next[87], renamed);
  for (let index = 0; index < current.length; index += 1) {
    if (index !== 87) assert.equal(next[index], current[index]);
  }
});
