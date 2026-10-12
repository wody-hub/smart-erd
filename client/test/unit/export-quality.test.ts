import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_EXPORT_QUALITY_PROFILE,
  DEFAULT_EXPORT_QUALITY_PRESET,
  EXPORT_QUALITY_PRESETS,
  resolveExportQualityProfile,
  getSafePixelRatio,
  isCanvasLimited,
} from '../../src/lib/export/export-core.js';

test('DEFAULT_EXPORT_QUALITY_PROFILE prefers high resolution exports', () => {
  assert.equal(DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio, 4);
  assert.equal(DEFAULT_EXPORT_QUALITY_PROFILE.pdfPixelRatio, 3);
  assert.equal(DEFAULT_EXPORT_QUALITY_PROFILE.jpegQuality, 1);
});

test('DEFAULT_EXPORT_QUALITY_PRESET uses balanced export speed and readability', () => {
  assert.equal(DEFAULT_EXPORT_QUALITY_PRESET, 'balanced');
});

test('EXPORT_QUALITY_PRESETS exposes fast balanced and high profiles', () => {
  assert.deepEqual(Object.keys(EXPORT_QUALITY_PRESETS), ['fast', 'balanced', 'high']);
  assert.equal(EXPORT_QUALITY_PRESETS.fast.imagePixelRatio, 2);
  assert.equal(EXPORT_QUALITY_PRESETS.balanced.imagePixelRatio, 3);
  assert.equal(EXPORT_QUALITY_PRESETS.high.imagePixelRatio, 4);
  assert.equal(EXPORT_QUALITY_PRESETS.fast.pdfPixelRatio, 1.5);
  assert.equal(EXPORT_QUALITY_PRESETS.balanced.pdfPixelRatio, 2);
  assert.equal(EXPORT_QUALITY_PRESETS.high.pdfPixelRatio, 3);
});

test('resolveExportQualityProfile preserves selected preset for small diagrams', () => {
  assert.deepEqual(
    resolveExportQualityProfile('balanced', 2000, 1200),
    EXPORT_QUALITY_PRESETS.balanced,
  );
});

test('resolveExportQualityProfile lowers ratios for large diagrams', () => {
  const profile = resolveExportQualityProfile('high', 10000, 10000);

  assert.ok(profile.imagePixelRatio < EXPORT_QUALITY_PRESETS.high.imagePixelRatio);
  assert.ok(profile.pdfPixelRatio < EXPORT_QUALITY_PRESETS.high.pdfPixelRatio);
  assert.equal(profile.jpegQuality, EXPORT_QUALITY_PRESETS.high.jpegQuality);
  assert.equal(profile.tileCssSize, EXPORT_QUALITY_PRESETS.high.tileCssSize);
});

test('resolveExportQualityProfile keeps fast large exports at lower ratios than high', () => {
  const fast = resolveExportQualityProfile('fast', 10000, 10000);
  const high = resolveExportQualityProfile('high', 10000, 10000);

  assert.ok(fast.imagePixelRatio < high.imagePixelRatio);
  assert.ok(fast.pdfPixelRatio <= high.pdfPixelRatio);
});

test('getSafePixelRatio keeps requested ratio when canvas dimensions are safe', () => {
  assert.equal(getSafePixelRatio(2000, 1200, 4), 4);
});

test('getSafePixelRatio lowers requested ratio to stay within canvas dimension limit', () => {
  const ratio = getSafePixelRatio(9000, 3000, 4);

  assert.equal(Number(ratio.toFixed(3)), 1.82);
});

test('getSafePixelRatio supports explicit lower requested image ratios', () => {
  assert.equal(getSafePixelRatio(2000, 1200, 2), 2);
});

test('isCanvasLimited detects exports that cannot safely render at 1x', () => {
  assert.equal(isCanvasLimited(17000, 1000), true);
  assert.equal(isCanvasLimited(16000, 1000), false);
});
