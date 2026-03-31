import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDF_MAX_PAGE_DIMENSION,
  getSinglePagePdfLayout,
  getSinglePagePdfPixelRatio,
} from '../../src/lib/export/export-pdf.js';

test('getSinglePagePdfLayout keeps small diagrams at original size', () => {
  assert.deepEqual(getSinglePagePdfLayout(3200, 1800), {
    pageWidth: 3200,
    pageHeight: 1800,
  });
});

test('getSinglePagePdfLayout scales oversized diagrams into one PDF page', () => {
  assert.deepEqual(getSinglePagePdfLayout(28_800, 9_600), {
    pageWidth: PDF_MAX_PAGE_DIMENSION,
    pageHeight: 4800,
  });
});

test('getSinglePagePdfPixelRatio preserves safe ratio when area is small enough', () => {
  assert.equal(getSinglePagePdfPixelRatio(4000, 3000, 2), 2);
});

test('getSinglePagePdfPixelRatio lowers ratio when full render area is too large', () => {
  const pixelRatio = getSinglePagePdfPixelRatio(10_000, 10_000, 1.6);

  assert.equal(Number(pixelRatio.toFixed(3)), 0.819);
});
