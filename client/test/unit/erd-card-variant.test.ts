import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  resolveErdCardVariant,
  resolveStoredTheme,
} from '../../src/lib/theme.js';
import { computeIeMarkers } from '../../src/components/erd/erdIeMarkers.js';

test('기본 테마는 lumen이고, 저장값이 없거나 잘못되면 lumen으로 복원된다', () => {
  assert.equal(DEFAULT_THEME, 'lumen');
  assert.equal(resolveStoredTheme(null), 'lumen');
  assert.equal(resolveStoredTheme(''), 'lumen');
  assert.equal(resolveStoredTheme('unknown'), 'lumen');
});

test('저장된 기존 테마 값은 그대로 유지된다', () => {
  for (const name of ['paper', 'graphite', 'midnight', 'lumen', 'eclipse'] as const) {
    assert.equal(resolveStoredTheme(name), name);
  }
});

test('ERD 카드 변형은 lumen만 ie이고 나머지 테마는 classic이다', () => {
  assert.equal(resolveErdCardVariant('lumen'), 'ie');
  for (const name of THEME_OPTIONS) {
    if (name !== 'lumen') {
      assert.equal(resolveErdCardVariant(name), 'classic', `${name} must stay classic`);
    }
  }
});

test('IE 마커: FK가 NOT NULL이면 부모 필수(||), NULL 허용이면 부모 선택(o|)', () => {
  assert.deepEqual(computeIeMarkers({ targetSymbol: 'many', optional: false }), {
    parent: 'mandatory',
    child: 'zero-or-many',
  });
  assert.deepEqual(computeIeMarkers({ targetSymbol: 'many', optional: true }), {
    parent: 'optional',
    child: 'zero-or-many',
  });
});

test('IE 마커: 자식 FK가 PK 전체이면 자식은 0..1(|o)', () => {
  assert.deepEqual(computeIeMarkers({ targetSymbol: 'one', optional: false }), {
    parent: 'mandatory',
    child: 'zero-or-one',
  });
});
