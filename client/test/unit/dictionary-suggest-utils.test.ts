import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TFunction } from 'i18next';
import { buildSuggestHintText } from '../../src/lib/dictionary-suggest-utils.js';

test('buildSuggestHintText 는 로컬 추천이 없을 때 null을 반환한다', () => {
  const t = ((key: string) => key) as unknown as TFunction;

  assert.equal(buildSuggestHintText(null, t), null);
});
