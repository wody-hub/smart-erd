import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScreenDesignTransformedSize } from '../../src/pages/screendesign/screen-design-transform-utils.js';

test('screen design transformed size uses absolute scale values for flipped resize gestures', () => {
  const nextSize = resolveScreenDesignTransformedSize({
    width: 240,
    height: 160,
    scaleX: -1.5,
    scaleY: -2,
  });

  assert.deepEqual(nextSize, {
    width: 360,
    height: 320,
  });
});

test('screen design transformed size preserves positive resize magnitudes', () => {
  const nextSize = resolveScreenDesignTransformedSize({
    width: 300,
    height: 180,
    scaleX: 1.25,
    scaleY: 0.5,
  });

  assert.deepEqual(nextSize, {
    width: 375,
    height: 90,
  });
});
