# ERD Export Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve ERD PNG/JPG/PDF download quality so table names, columns, and relation text remain readable even if export takes longer.

**Architecture:** Keep the existing `html-to-image` + `jsPDF` export stack, but replace fixed low-detail rendering with explicit quality profiles and tile-based high-DPI rendering. Large diagrams must be rendered in bounded tiles to avoid browser canvas limits while preserving font sharpness.

**Tech Stack:** React, React Flow, `html-to-image`, `jspdf`, Node test runner, TypeScript.

## Global Constraints

- Do not change ERD layout data or persistence behavior.
- Preserve existing export menu formats: PNG, JPG, SVG, PDF.
- Prefer quality over speed; longer downloads are acceptable.
- Avoid adding a new export dependency unless tile rendering with the existing stack proves impossible.
- Keep browser canvas dimensions under safe limits for Chrome/Safari.
- Use TDD for export ratio and PDF/tile calculation logic.

---

## Current State

- `client/src/hooks/useExportDiagram.ts` calculates node bounds and passes `CaptureOptions` to export executors.
- `client/src/lib/export/export-core.ts` owns canvas limits, default pixel ratio, capture style, and blob download helpers.
- `client/src/lib/export/export-executors.ts` renders PNG/JPG/SVG/PDF using `html-to-image`; PDF currently captures one raster image and inserts it into `jsPDF`.
- `client/src/lib/export/export-pdf.ts` limits single-page PDF area via `PDF_SINGLE_PAGE_MAX_AREA`, which can reduce effective pixel ratio and make text hard to read.
- `client/test/unit/export-pdf.test.ts` already tests PDF layout and ratio logic.

## Target Behavior

- PNG/JPG exports use a higher default quality ratio than today.
- JPG uses max or near-max JPEG quality.
- PDF export uses high-DPI tiles for large diagrams instead of degrading a single giant raster capture.
- Single-page PDF remains available for normal diagrams.
- Large diagrams may take longer, but progress text should indicate high-resolution rendering is happening.
- SVG stays vector-oriented and should continue embedding fonts through the existing `fontEmbedCSS` path.

---

## Task 1: Add Export Quality Configuration

**Files:**

- Modify: `client/src/lib/export/export-types.ts`
- Modify: `client/src/lib/export/export-core.ts`
- Test: `client/test/unit/export-quality.test.ts`

**Interfaces:**

- Produces: `ExportQualityProfile`, `DEFAULT_EXPORT_QUALITY_PROFILE`, `getSafePixelRatio(width, height, desiredRatio)`
- Consumes: existing `CaptureOptions` and `RenderConfigOptions`

- [ ] **Step 1: Write failing tests for quality ratio limits**

Create `client/test/unit/export-quality.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd client
npm run test:unit -- export-quality
```

Expected: FAIL because `DEFAULT_EXPORT_QUALITY_PROFILE` or the new `getSafePixelRatio(width, height, desiredRatio)` signature does not exist yet.

- [ ] **Step 3: Add quality profile and ratio API**

Update `client/src/lib/export/export-types.ts`:

```ts
/** Export quality knobs shared by image and PDF renderers. */
export interface ExportQualityProfile {
  /** PNG/JPG capture pixel ratio. Higher is sharper but slower. */
  imagePixelRatio: number;
  /** PDF capture pixel ratio before tile/page constraints. */
  pdfPixelRatio: number;
  /** JPEG quality passed to canvas.toBlob. */
  jpegQuality: number;
  /** Maximum tile side length in CSS px before pixel ratio is applied. */
  tileCssSize: number;
}
```

Update `client/src/lib/export/export-core.ts`:

```ts
import type { CaptureOptions, ExportQualityProfile, RenderConfigOptions } from './export-types';

/** High quality default: slower exports are acceptable for readable ERD documents. */
export const DEFAULT_EXPORT_QUALITY_PROFILE: ExportQualityProfile = {
  imagePixelRatio: 4,
  pdfPixelRatio: 3,
  jpegQuality: 1,
  tileCssSize: 4096,
};

const normalizeRequestedPixelRatio = (requestedPixelRatio: number): number =>
  Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0 ? requestedPixelRatio : 1;

export const getSafePixelRatio = (
  width: number,
  height: number,
  requestedPixelRatio = DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio,
): number => {
  const boundedWidth = Math.max(1, width);
  const boundedHeight = Math.max(1, height);
  const normalizedRatio = normalizeRequestedPixelRatio(requestedPixelRatio);
  return Math.min(
    normalizedRatio,
    MAX_CANVAS_DIMENSION / boundedWidth,
    MAX_CANVAS_DIMENSION / boundedHeight,
  );
};
```

Keep `isCanvasLimited(width, height)` using `MAX_CANVAS_DIMENSION` and update existing call sites to pass the desired ratio explicitly where needed.

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
cd client
npm run test:unit -- export-quality export-pdf
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/export/export-types.ts client/src/lib/export/export-core.ts client/test/unit/export-quality.test.ts
git commit -m "Add high quality export configuration"
```

---

## Task 2: Raise PNG/JPG Export Quality

**Files:**

- Modify: `client/src/lib/export/export-executors.ts`
- Modify: `client/src/hooks/useExportDiagram.ts`
- Test: `client/test/unit/export-quality.test.ts`

**Interfaces:**

- Consumes: `DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio`, `DEFAULT_EXPORT_QUALITY_PROFILE.jpegQuality`, `getSafePixelRatio(width, height, requestedRatio)`
- Produces: PNG/JPG renderers use high-DPI capture without changing toolbar API.

- [ ] **Step 1: Write failing test for image ratio calculation**

Append to `client/test/unit/export-quality.test.ts`:

```ts
test('getSafePixelRatio supports explicit lower requested image ratios', () => {
  assert.equal(getSafePixelRatio(2000, 1200, 2), 2);
});
```

- [ ] **Step 2: Run targeted test**

Run:

```bash
cd client
npm run test:unit -- export-quality
```

Expected: PASS after Task 1; this protects the explicit ratio API before wiring it into executors.

- [ ] **Step 3: Wire high quality settings into PNG/JPG export**

Update `client/src/lib/export/export-executors.ts` inside `exportImageDiagram`:

```ts
import {
  DEFAULT_EXPORT_QUALITY_PROFILE,
  buildRenderConfig,
  convertSvgDataUrlToBlob,
  downloadBlobFile,
  getExportBackgroundColor,
  getSafePixelRatio,
  renderCanvasBlob,
} from './export-core';

const pixelRatio = getSafePixelRatio(
  opts.imageWidth,
  opts.imageHeight,
  DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio,
);

const canvas = await toCanvas(
  opts.viewportEl,
  buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
    width: opts.imageWidth,
    height: opts.imageHeight,
    pixelRatio,
    quality: format === 'jpg' ? DEFAULT_EXPORT_QUALITY_PROFILE.jpegQuality : undefined,
    type: mimeType,
  }),
);

const blob = await renderCanvasBlob(
  canvas,
  mimeType,
  format === 'jpg' ? DEFAULT_EXPORT_QUALITY_PROFILE.jpegQuality : undefined,
);
```

Do not alter the SVG export path in this task.

- [ ] **Step 4: Run unit tests and typecheck**

Run:

```bash
cd client
npm run test:unit -- export-quality export-pdf
npx tsc --noEmit --pretty false
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/export/export-executors.ts client/src/hooks/useExportDiagram.ts client/test/unit/export-quality.test.ts
git commit -m "Increase ERD image export resolution"
```

---

## Task 3: Add PDF Tile Planning Logic

**Files:**

- Modify: `client/src/lib/export/export-pdf.ts`
- Test: `client/test/unit/export-pdf.test.ts`

**Interfaces:**

- Produces: `PdfTile`, `buildPdfTilePlan(width, height, tileCssSize)`
- Consumes: `DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize`

- [ ] **Step 1: Write failing tests for PDF tile plan**

Append to `client/test/unit/export-pdf.test.ts`:

```ts
import { buildPdfTilePlan } from '../../src/lib/export/export-pdf.js';

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
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd client
npm run test:unit -- export-pdf
```

Expected: FAIL because `buildPdfTilePlan` does not exist.

- [ ] **Step 3: Implement tile plan**

Update `client/src/lib/export/export-pdf.ts`:

```ts
export interface PdfTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const buildPdfTilePlan = (width: number, height: number, tileCssSize: number): PdfTile[] => {
  const boundedWidth = Math.max(1, Math.ceil(width));
  const boundedHeight = Math.max(1, Math.ceil(height));
  const boundedTileSize = Math.max(1, Math.floor(tileCssSize));
  const tiles: PdfTile[] = [];

  for (let y = 0; y < boundedHeight; y += boundedTileSize) {
    for (let x = 0; x < boundedWidth; x += boundedTileSize) {
      tiles.push({
        x,
        y,
        width: Math.min(boundedTileSize, boundedWidth - x),
        height: Math.min(boundedTileSize, boundedHeight - y),
      });
    }
  }

  return tiles;
};
```

- [ ] **Step 4: Run PDF tests**

Run:

```bash
cd client
npm run test:unit -- export-pdf
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/export/export-pdf.ts client/test/unit/export-pdf.test.ts
git commit -m "Plan tiled ERD PDF exports"
```

---

## Task 4: Render PDF as High-DPI Tiles

**Files:**

- Modify: `client/src/lib/export/export-executors.ts`
- Modify: `client/src/lib/export/export-pdf.ts`
- Test: `client/test/unit/export-pdf.test.ts`

**Interfaces:**

- Consumes: `buildPdfTilePlan`, `getSinglePagePdfLayout`, `DEFAULT_EXPORT_QUALITY_PROFILE.pdfPixelRatio`
- Produces: `exportPdfDiagram` inserts each tile at the correct PDF position and keeps text readable.

- [ ] **Step 1: Add test for PDF tile scaling helpers**

Append to `client/test/unit/export-pdf.test.ts`:

```ts
import { getPdfTilePlacement } from '../../src/lib/export/export-pdf.js';

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
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd client
npm run test:unit -- export-pdf
```

Expected: FAIL because `getPdfTilePlacement` does not exist.

- [ ] **Step 3: Implement tile placement helper**

Update `client/src/lib/export/export-pdf.ts`:

```ts
export interface PdfTilePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getPdfTilePlacement = (
  tile: PdfTile,
  layout: SinglePagePdfLayout,
  imageWidth: number,
  imageHeight: number,
): PdfTilePlacement => {
  const scaleX = layout.pageWidth / Math.max(1, imageWidth);
  const scaleY = layout.pageHeight / Math.max(1, imageHeight);
  return {
    x: tile.x * scaleX,
    y: tile.y * scaleY,
    width: tile.width * scaleX,
    height: tile.height * scaleY,
  };
};
```

- [ ] **Step 4: Rewrite PDF export to render and place tiles**

Update `client/src/lib/export/export-executors.ts` inside `exportPdfDiagram`:

```ts
const [{ toCanvas }, { jsPDF }, fontEmbedCSS] = await Promise.all([
  getHtmlToImageModule(),
  getJsPdfModule(),
  getFontEmbedCss(opts.viewportEl),
]);

const layout = getSinglePagePdfLayout(opts.imageWidth, opts.imageHeight);
const tiles = buildPdfTilePlan(
  opts.imageWidth,
  opts.imageHeight,
  DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize,
);
const pixelRatio = getSafePixelRatio(
  Math.min(opts.imageWidth, DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize),
  Math.min(opts.imageHeight, DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize),
  DEFAULT_EXPORT_QUALITY_PROFILE.pdfPixelRatio,
);

const doc = new jsPDF({
  orientation: layout.pageWidth >= layout.pageHeight ? 'landscape' : 'portrait',
  unit: 'px',
  format: [layout.pageWidth, layout.pageHeight],
  compress: true,
});

for (const [index, tile] of tiles.entries()) {
  await progress.updateExportProgress({
    format,
    stage: 'rendering',
    stageKey: 'erd.export.progress.rendering',
    detailKey: 'erd.export.progress.renderingTile',
    detailValues: { current: index + 1, total: tiles.length },
    progressPercent: Math.round(((index + 1) / tiles.length) * 80),
    yieldAfter: true,
  });

  const canvas = await toCanvas(
    opts.viewportEl,
    buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
      width: tile.width,
      height: tile.height,
      offsetX: tile.x,
      offsetY: tile.y,
      pixelRatio,
      type: 'image/png',
    }),
  );

  const dataUrl = canvas.toDataURL('image/png');
  const placement = getPdfTilePlacement(tile, layout, opts.imageWidth, opts.imageHeight);
  doc.addImage(dataUrl, 'PNG', placement.x, placement.y, placement.width, placement.height);
}
```

Return `{ tiledPageCount: tiles.length > 1 ? tiles.length : 0 }` so existing success toast still reports large tiled exports.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
cd client
npm run test:unit -- export-pdf export-quality
npx tsc --noEmit --pretty false
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/export/export-executors.ts client/src/lib/export/export-pdf.ts client/test/unit/export-pdf.test.ts
git commit -m "Render ERD PDFs as high resolution tiles"
```

---

## Task 5: Improve Progress Copy for Slow High-Quality Exports

**Files:**

- Modify: `client/src/i18n/locales/ko/translation.json`
- Modify: `client/src/i18n/locales/en/translation.json`
- Modify: `client/src/lib/export/export-executors.ts`

**Interfaces:**

- Consumes: existing `ExportProgressDialog`
- Produces: user-visible tile progress text during high-quality PDF export.

- [ ] **Step 1: Add locale keys**

Update `client/src/i18n/locales/ko/translation.json` under `erd.export.progress`:

```json
"renderingTile": "고해상도 PDF 조각을 렌더링하는 중입니다. ({{current}}/{{total}})"
```

Update `client/src/i18n/locales/en/translation.json` under `erd.export.progress`:

```json
"renderingTile": "Rendering high-resolution PDF tile {{current}}/{{total}}."
```

- [ ] **Step 2: Verify the executor uses the new key**

Ensure `exportPdfDiagram` tile loop uses:

```ts
detailKey: 'erd.export.progress.renderingTile',
detailValues: { current: index + 1, total: tiles.length },
```

- [ ] **Step 3: Run i18n-safe checks**

Run:

```bash
cd client
npm run test:unit -- export-pdf export-quality
npx tsc --noEmit --pretty false
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/i18n/locales/ko/translation.json client/src/i18n/locales/en/translation.json client/src/lib/export/export-executors.ts
git commit -m "Show high quality PDF export progress"
```

---

## Task 6: Browser QA for Readability

**Files:**

- No source edits expected.
- Optional test artifact: `/tmp/smart-erd/export-quality/`

**Interfaces:**

- Consumes: running frontend and backend.
- Produces: manual QA evidence for exported PNG/PDF quality.

- [ ] **Step 1: Start services**

Run backend and frontend using the project default remembered by the user:

```bash
cd /Users/j.jaeyo/Project/ETC/smart-erd
docker compose up -d postgres
SERVER_PORT=9502 ./gradlew bootRun --args="--spring.profiles.active=local,test"

cd client
npm run test:frontend -- --host 127.0.0.1
```

Expected:

- Backend listens on `http://127.0.0.1:9502`
- Frontend listens on `http://127.0.0.1:4502`

- [ ] **Step 2: Export a dense ERD**

Use the known project ERD or a dense test diagram. Export:

- PNG
- JPG
- PDF
- SVG

Expected:

- PNG text is readable at 100% zoom in Preview or browser image viewer.
- JPG text is readable and does not show severe compression artifacts.
- PDF text is readable at 100% zoom.
- SVG still opens and remains vector/sharp.

- [ ] **Step 3: Check console and network errors**

Using browser devtools or Playwright console capture, verify:

```text
No uncaught export errors
No canvas size errors
No failed font resource requests caused by export
```

- [ ] **Step 4: Run final verification**

Run:

```bash
cd client
npm run test:unit -- export-pdf export-quality
npx tsc --noEmit --pretty false
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit final QA notes only if source changed**

If Task 6 requires source fixes:

```bash
git add <changed-files>
git commit -m "Polish ERD export quality"
```

If no source changes are needed, do not create a commit for QA-only evidence.

---

## Rollback Plan

- If high-DPI PNG/JPG causes memory failures on common diagrams, lower `DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio` from `4` to `3`.
- If PDF tile stitching shows seams, reduce `tileCssSize` to `3072` and overlap tiles by 1 CSS pixel before placement.
- If PDF file size becomes unacceptable, keep high-quality PNG/JPG and offer PDF quality as a separate menu option in a follow-up.

## Success Criteria

- Exported ERD fonts are readable in PNG and PDF at normal viewer zoom.
- Large diagrams no longer silently degrade to very low PDF pixel ratio.
- Existing SVG export remains unaffected.
- Unit tests cover quality ratio and tile planning logic.
- `npm run build` passes.
