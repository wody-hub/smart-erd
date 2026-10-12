# Export Quality Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax tracking.

**Goal:** Add fast/balanced/high export quality choices and adaptive pixel ratios for large ERD diagrams.

**Architecture:** Keep export rendering in the existing `client/src/lib/export` modules. Add pure quality selection helpers, pass the resolved profile into image/PDF executors, and expose preset-specific export menu actions from the ERD toolbar.

**Tech Stack:** TypeScript, React, React Flow, html-to-image, jsPDF, Node test runner.

## Global Constraints

- Preserve existing PDF tile area protection for blank-canvas prevention.
- Default user action should prefer balanced speed/quality, not maximum quality.
- SVG export remains vector and does not need quality presets.
- Do not alter unrelated PDF export bugfix changes already in the worktree.

---

### Task 1: Quality Preset Helpers

**Files:**

- Modify: `client/src/lib/export/export-types.ts`
- Modify: `client/src/lib/export/export-core.ts`
- Test: `client/test/unit/export-quality.test.ts`

**Interfaces:**

- Produces: `ExportQualityPreset`, `EXPORT_QUALITY_PRESETS`, `DEFAULT_EXPORT_QUALITY_PRESET`, `resolveExportQualityProfile(preset, width, height)`.

- [x] **Step 1: Write failing tests**
    - Add tests for fast/balanced/high base ratios.
    - Add tests that balanced/high ratios are lowered for large diagrams.

- [x] **Step 2: Run test verify fails**
    - Run: `npm run test:unit -- export-quality`
    - Expected: FAIL because helpers are not implemented.

- [x] **Step 3: Implement minimal helpers**
    - Add preset type and profile table.
    - Add adaptive area-based ratio lowering while respecting `getSafePixelRatio`.

- [x] **Step 4: Run test verify passes**
    - Run: `npm run test:unit -- export-quality`
    - Expected: PASS.

### Task 2: Executor Profile Injection

**Files:**

- Modify: `client/src/lib/export/export-executors.ts`
- Test: `client/test/unit/export-executors.test.ts`

**Interfaces:**

- Consumes: `ExportQualityProfile`.
- Produces: image/PDF executors accepting optional `qualityProfile`.

- [x] **Step 1: Write failing tests**
    - Add test that image export uses a provided balanced profile instead of global high defaults.
    - Add test that PDF tile export uses the provided profile for tile size and pixel ratio.

- [x] **Step 2: Run test verify fails**
    - Run: `npm run test:unit -- export-executors`
    - Expected: FAIL because executor options do not accept profile.

- [x] **Step 3: Implement minimal executor wiring**
    - Add `qualityProfile?: ExportQualityProfile` to shared export options.
    - Use the provided profile or fallback default.

- [x] **Step 4: Run test verify passes**
    - Run: `npm run test:unit -- export-executors`
    - Expected: PASS.

### Task 3: ERD Toolbar Quality Actions

**Files:**

- Modify: `client/src/hooks/useExportDiagram.ts`
- Modify: `client/src/components/erd/CanvasToolbar.tsx`
- Modify: `client/src/components/erd/ERDCanvas.tsx`
- Modify: `client/src/components/erd/PreviewCanvas.tsx`
- Modify: `client/src/i18n/locales/en/translation.json`
- Modify: `client/src/i18n/locales/ko/translation.json`

**Interfaces:**

- Consumes: `ExportQualityPreset`.
- Produces: `exportPng(preset?)`, `exportJpg(preset?)`, `exportPdf(preset?)` and toolbar submenu actions.

- [x] **Step 1: Implement hook preset argument**
    - Resolve profile from capture dimensions and selected preset.

- [x] **Step 2: Implement toolbar submenu**
    - Replace single PNG/JPG/PDF actions with fast/balanced/high submenu items.
    - Keep SVG as a single action.

- [x] **Step 3: Add i18n labels**
    - Add export quality labels for English and Korean.

- [x] **Step 4: Run verification**
    - Run: `npm run test:unit -- export-quality export-executors`
    - Run: `npx tsc --noEmit --pretty false`
