---
phase: 03-화면기획-플러그인
plan: 02
subsystem: testing
tags: [screen-spec, collaboration, playwright, yjs, scope-lock]

requires:
  - phase: 03-화면기획-플러그인
    provides: 03-01 screen-spec authoring/export evidence and persisted Y.Doc handoff
provides:
  - screen-spec three-account collaboration Playwright smoke evidence
  - visible remote/lock/rejected-edit status for screen-spec collaboration
  - screen-spec scope resolver cascade and malformed-command coverage
affects: [screen-spec, collaboration, e2e, scope-lock]

tech-stack:
  added: []
  patterns:
    - Three isolated Playwright browser contexts for owner/member-one/member-two collaboration evidence
    - Screen-spec Y.Doc root observation to keep React projection in sync with remote updates
    - Temporary remote scope lock UX for same-scope edit rejection

key-files:
  created:
    - client/e2e/smoke/screen-spec-three-account-collaboration.spec.ts
  modified:
    - client/e2e/shared/screen-spec-e2e.ts
    - client/src/pages/screendesign/ScreenDesignInteractivePage.tsx
    - client/src/pages/screendesign/ScreenDesignEditorShell.tsx
    - client/src/pages/screendesign/ScreenDesignInspector.tsx
    - client/src/pages/screendesign/use-screen-design-document.ts
    - client/src/pages/screendesign/screen-design-document.ts
    - client/src/collaboration/channel/document/use-screen-design-document-runtime.ts
    - client/src/i18n/locales/ko/translation.json
    - client/src/i18n/locales/en/translation.json
    - src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolver.java
    - src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecCollaborationPlugin.java
    - src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java

key-decisions:
  - "ScreenSpecCollaborationPlugin.validationHook() remains an intentional v1 no-op; validation evidence comes from frontend model normalization, mutation policy/applier tests, backend scope resolver tests, and browser collaboration evidence."
  - "Same-scope collaboration UX uses a real runtime rejected state derived from recent remote Yjs scopes, not final convergence after refresh."
  - "Master update/delete and screen frame mutation scopes include cascade coordination so affected instances are protected consistently."

patterns-established:
  - "Collaboration E2E diagnostics fail unfiltered browser warnings/errors/pageerrors while documenting each intentional filter."
  - "Screen-spec inspector exposes deterministic numeric position and size controls used by E2E and useful for precise editing."

requirements-completed: [SPEC-02, SPEC-03]

duration: multi-session
completed: 2026-05-29
---

# Phase 03-02 Summary: Screen-Spec Three-Account Collaboration Evidence

**Three-account screen-spec collaboration now proves master lifecycle propagation, persisted state, and same-scope lock/rejected-edit UX.**

## Performance

- **Duration:** multi-session
- **Completed:** 2026-05-29T10:05:07+09:00
- **Tasks:** 3
- **Files modified:** 15 tracked files

## Accomplishments

- Added `screen-spec-three-account-collaboration.spec.ts`, provisioning owner/member-one/member-two accounts, inviting members, opening three isolated browser contexts, and asserting access through the real `screen-spec` document bootstrap path.
- Covered screen rename, master create/update/delete, instance placement, inherited master propagation, member move/resize, save/reload persistence, and orphaned instance behavior.
- Added user-visible collaboration status for remote changes, temporary same-scope locks, and rejected edits through the existing screen-spec shell.
- Fixed remote Y.Doc projection staleness by observing the screen-spec root directly and syncing React state on remote transactions.
- Strengthened backend scope resolver tests for master cascade, screen frame cascade, and malformed-command fallback.

## Verification

- ✅ `cd client && npm run test:e2e -- e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0`
  - 1 Playwright smoke passed, including diagnostics and lock/rejected-edit assertions.
- ✅ `cd client && npm run test:unit -- screen-spec screen-design`
  - 363 tests passed.
- ✅ `./gradlew test --tests '*ScreenSpecScopeResolverTest'`
  - Build successful.
- ✅ `cd client && npm run lint:docs`
  - 7 files checked, no violations.
- ✅ `git diff --check`
- ❌ `cd client && npm run build`
  - Blocked by pre-existing WBS errors outside this plan:
  - `client/src/components/wbs/SortableWbsRow.tsx(332,21)` missing typed i18n key `wbs.validation.nameRequired`
  - `client/src/components/wbs/SortableWbsRowCells.tsx(84,3)` unused `milestoneName`

## Acceptance Criteria

- ✅ Three-account fixture includes `member-one`, `member-two`, `pluginId: 'screen-spec'`, access checks, and diagnostics.
- ✅ Scenario includes `Owner screen A`, `Owner screen B`, `Shared CTA`, `Shared CTA Updated`, `Member one screen`, move/resize, lock/conflict/rejected status, delete/orphan handling, and reload persistence.
- ✅ `ScreenDesignEditorShell` exposes `collaborationStatusLabel` and `screen-spec-collaboration-status`.
- ✅ Korean/English `screenSpec.status.remoteChanged`, `locked`, and `editRejected` translations are present.
- ✅ UI diff uses semantic token classes and introduces no hardcoded UI color hex values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Remote updates reached member Y.Doc but did not refresh React projection**
- **Found during:** Task 2 three-account propagation assertion
- **Issue:** Members received websocket `yjs-update` frames and their Y.Doc contained owner screen names, but the screen-spec React document snapshot stayed stale.
- **Fix:** Added direct `root.observeDeep` sync in `useScreenDesignDocument` and added a runtime update fallback in `use-screen-design-document-runtime`.
- **Verification:** Three-account E2E now observes owner/member changes without refresh.

**2. [Rule 2 - Missing Critical] Same-scope lock UX was not exposed for screen-spec**
- **Found during:** Task 3 lock/conflict acceptance
- **Issue:** Final Y.Doc convergence could hide overwrite risk; the UI had no real rejected-edit status for same-scope conflicts.
- **Fix:** Derived temporary remote scope locks from Yjs affected scopes, rejected conflicting local exclusive commands, and surfaced `locked` / `editRejected` status text.
- **Verification:** E2E asserts lock status before the conflicting rename and rejected status after it.

**3. [Rule 3 - Blocking] Keyboard move was unstable under active collaboration focus and locks**
- **Found during:** Task 2 move/resize propagation
- **Issue:** Keyboard arrow movement could be swallowed by focused controls or rejected during a cascade lock window.
- **Fix:** Added deterministic X/Y and width/height inspector inputs and made E2E helpers prefer those controls.
- **Verification:** Three-account E2E passes move and resize propagation checks.

---

**Total deviations:** 3 auto-fixed. **Impact:** All fixes are scoped to screen-spec collaboration evidence and runtime correctness; backend validation remains the planned v1 no-op.

## Issues Encountered

- `npm run build` was blocked during 03-02 by unrelated WBS TypeScript errors listed above. These were resolved during Phase 3 verify-work; the final build gate now passes.
- Browser diagnostics intentionally filter only known benign ResizeObserver, exact Yjs pre-integration access, and transient dev StrictMode ticket websocket 403 messages; all other warnings/errors fail the E2E.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

03-02 supplies the required SPEC-03 three-account evidence and reinforces SPEC-02 collaboration propagation evidence. Final Phase 3 completion is recorded in `03-VALIDATION.md`, `03-VERIFICATION.md`, and `03-UAT.md`.

---
*Phase: 03-화면기획-플러그인*
*Completed: 2026-05-29*
