import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DSL_LANGUAGE_CONFIGURATION } from '../../src/lib/monaco-dsl-language-config.js';

test('DSL_LANGUAGE_CONFIGURATION 은 작은따옴표와 큰따옴표 surrounding pair 를 제공한다', () => {
  assert.deepEqual(
    DSL_LANGUAGE_CONFIGURATION.surroundingPairs?.filter(
      (pair) => pair.open === "'" || pair.open === '"',
    ),
    [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  );
});

test('DSL_LANGUAGE_CONFIGURATION 은 따옴표 auto closing pair 를 제공한다', () => {
  assert.deepEqual(
    DSL_LANGUAGE_CONFIGURATION.autoClosingPairs?.filter(
      (pair) => pair.open === "'" || pair.open === '"',
    ),
    [
      { open: '"', close: '"', notIn: ['string', 'comment'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
  );
});
