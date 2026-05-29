---
phase: 03-화면기획-플러그인
plan: 01
subsystem: testing
tags: [screen-spec, playwright, yjs, export, persistence]

requires:
  - phase: 03-화면기획-플러그인
    provides: existing screen-spec editor, Yjs runtime, and PNG/PDF export runtime
provides:
  - screen-spec single-user authoring/export Playwright smoke evidence
  - explicit Save action for screen-spec Y.Doc snapshots
  - persisted snapshot handoff guard for screen-spec re-entry
affects: [screen-spec, collaboration, export, e2e]

tech-stack:
  added: []
  patterns:
    - Playwright download validation for PNG/PDF export smoke tests
    - collaboration-ready gated screen-spec document structure initialization

key-files:
  created:
    - client/e2e/smoke/screen-spec-authoring-export.spec.ts
  modified:
    - client/e2e/shared/screen-spec-e2e.ts
    - client/src/pages/screendesign/use-screen-design-session.ts
    - client/src/pages/screendesign/use-screen-design-document.ts
    - client/src/pages/screendesign/screen-design-document.ts
    - client/src/collaboration/YjsProvider.ts
    - .planning/phases/03-화면기획-플러그인/03-VALIDATION.md

key-decisions:
  - "Screen-spec explicit Save persists the live Y.Doc snapshot through the existing ydoc-snapshot API."
  - "Persisted screen-spec documents must not create local Y.Doc root structures before remote snapshot handoff."
  - "PNG/PDF export evidence uses real Playwright downloads and binary structure checks."

patterns-established:
  - "E2E helpers use production flows and passive data-testid attributes only where semantic locators are insufficient."
  - "Snapshot-backed screen-spec re-entry waits for collaboration readiness before default-screen creation."

requirements-completed: [SPEC-01, SPEC-02, SPEC-04]

duration: multi-session
completed: 2026-05-29
---

# Phase 03-01 Summary: Screen-Spec Authoring Export Evidence

**Browser evidence now covers screen-spec master authoring, inherited propagation, persistence re-entry, and PNG/PDF exports.**

## Performance

- **Duration:** multi-session
- **Completed:** 2026-05-29T09:12:49+09:00
- **Tasks:** 3
- **Files modified:** 14 tracked files

## Accomplishments

- Added `screen-spec-authoring-export.spec.ts`, which provisions an isolated `screen-spec` document, creates a custom master, places inherited instances on two screens, edits the master label/color, saves, reloads, and validates PNG/PDF downloads.
- Added a screen-spec E2E helper layer for login/open, master/screen actions, synthetic drag/drop, save, and binary export assertions.
- Fixed persisted screen-spec re-entry by preventing pre-handoff local Y.Doc structure writes from masking the remote snapshot.
- Added explicit Save UI and i18n strings for screen-spec snapshot persistence.

## Verification

- ✅ `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0`
- ✅ `cd client && npm run test:unit -- screen-design` (363 tests)
- ✅ `cd client && npm run test:unit -- screen-spec`
- ✅ `cd client && npm run lint:docs`
- ❌ `cd client && npm run build`
  - Blocked by pre-existing WBS errors:
  - `client/src/components/wbs/SortableWbsRow.tsx(332,21)` missing typed i18n key `wbs.validation.nameRequired`
  - `client/src/components/wbs/SortableWbsRowCells.tsx(84,3)` unused `milestoneName`

## Deviations From Plan

- The plan expected mostly test/helper changes, but the smoke exposed a real screen-spec persistence bug. The fix is scoped to screen-spec/Yjs handoff behavior:
  - `YjsProvider` now marks snapshot response handoff as synced for single-user persisted documents.
  - `readScreenDesignDocument` can read without creating Y.Doc structures.
  - `useScreenDesignDocument` only ensures structures after collaboration is ready.

## Next Phase Readiness

03-01 closes SPEC-01, SPEC-02, and SPEC-04 automated single-user evidence. Phase 3 still needs 03-02 collaboration/lock evidence for SPEC-03 and final closeout/manual QA in 03-03.
