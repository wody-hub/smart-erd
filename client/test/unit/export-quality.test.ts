import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_EXPORT_QUALITY_PROFILE,
  getSafePixelRatio,
  isCanvasLimited,
} from '../../src/lib/export/export-core.js';

test('DEFAULT_EXPORT_QUALITY_PROFILE prefers high resolution exports', () => {
  assert.equal(DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio, 4);
  assert.equal(DEFAULT_EXPORT_QUALITY_PROFILE.pdfPixelRatio, 3);
  assert.equal(DEFAULT_EXPORT_QUALITY_PROFILE.jpegQuality, 1);
});

test('getSafePixelRatio keeps requested ratio when canvas dimensions are safe', () => {
  assert.equal(getSafePixelRatio(2000, 1200, 4), 4);
});

test('getSafePixelRatio lowers requested ratio to stay within canvas dimension limit', () => {
  const ratio = getSafePixelRatio(9000, 3000, 4);

  assert.equal(Number(ratio.toFixed(3)), 1.82);
});

test('isCanvasLimited detects exports that cannot safely render at 1x', () => {
  assert.equal(isCanvasLimited(17000, 1000), true);
  assert.equal(isCanvasLimited(16000, 1000), false);
});
