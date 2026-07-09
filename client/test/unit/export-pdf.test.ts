import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDF_MAX_PAGE_DIMENSION,
  buildPdfTilePlan,
  getPdfTilePlacement,
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

test('buildPdfTilePlan returns one full-size tile for small diagrams', () => {
  assert.deepEqual(buildPdfTilePlan(1200, 800, 4096), [
    { x: 0, y: 0, width: 1200, height: 800 },
  ]);
});

test('buildPdfTilePlan splits wide and tall diagrams into bounded tiles', () => {
  assert.deepEqual(buildPdfTilePlan(9000, 5000, 4096), [
    { x: 0, y: 0, width: 4096, height: 4096 },
    { x: 4096, y: 0, width: 4096, height: 4096 },
    { x: 8192, y: 0, width: 808, height: 4096 },
    { x: 0, y: 4096, width: 4096, height: 904 },
    { x: 4096, y: 4096, width: 4096, height: 904 },
    { x: 8192, y: 4096, width: 808, height: 904 },
  ]);
});

test('getPdfTilePlacement maps tile css coordinates into scaled PDF coordinates', () => {
  assert.deepEqual(
    getPdfTilePlacement(
      { x: 4096, y: 2048, width: 1024, height: 512 },
      { pageWidth: 5000, pageHeight: 2500 },
      10000,
      5000,
    ),
    { x: 2048, y: 1024, width: 512, height: 256 },
  );
});
