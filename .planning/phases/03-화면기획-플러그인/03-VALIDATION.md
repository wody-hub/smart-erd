---
phase: 3
slug: 화면기획-플러그인
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for screen-spec closeout execution. This is a planning-time strategy; execution must update it with actual evidence before Phase 3 is marked complete.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JUnit 5 / Node test / Playwright |
| **Config file** | `build.gradle`, `client/package.json`, `client/playwright.config.ts` |
| **Quick run command** | `./gradlew test --tests '*ScreenSpecScopeResolverTest' --tests '*DiagramServiceTest' && cd client && npm run test:unit -- screen-spec screen-design` |
| **Full suite command** | `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0 && cd .. && ./gradlew test --tests '*ScreenSpecScopeResolverTest' --tests '*DiagramServiceTest'` |
| **Estimated runtime** | ~300 seconds |

---

## Sampling Rate

- **After every task commit:** Run targeted unit tests touched by that task.
- **After every plan wave:** Run the screen-spec Playwright smoke spec(s) added in that wave.
- **Before `$gsd-verify-work`:** Full suite and dev-profile manual QA evidence must be recorded in `03-VERIFICATION.md`.
- **Max feedback latency:** 300 seconds for targeted validation; longer export/collaboration runs are acceptable only at wave boundaries.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 0 | SPEC-01, SPEC-04 | T-03-01 / T-03-02 | Test fixtures create isolated screen-spec docs and do not reuse credentials across runs | unit/e2e helper | `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0` | ✅ W1 | ✅ green |
| 03-01-02 | 03-01 | 1 | SPEC-01 | T-03-01 | User-visible authoring state persists after save/re-entry | e2e | `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0` | ✅ W1 | ✅ green |
| 03-01-03 | 03-01 | 1 | SPEC-04 | T-03-02 | Exported files are generated only through authenticated document access and are non-empty | e2e download | `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0` | ✅ W1 | ✅ green |
| 03-02-01 | 03-02 | 1 | SPEC-03 | T-03-03 / T-03-04 | Three distinct accounts share only team-authorized document access | e2e | `cd client && npm run test:e2e -- e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0` | ❌ W0 | ⬜ pending |
| 03-02-02 | 03-02 | 1 | SPEC-02, SPEC-03 | T-03-04 | Scope lock/conflict UX prevents silent same-scope overwrites | e2e + unit | `./gradlew test --tests '*ScreenSpecScopeResolverTest' && cd client && npm run test:e2e -- e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03-03 | 2 | SPEC-01, SPEC-02, SPEC-03, SPEC-04 | — | Evidence artifacts accurately describe residual risk and no-op validation policy | docs + commands | `git diff --check && cd client && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `client/e2e/smoke/screen-spec-authoring-export.spec.ts` — browser evidence for SPEC-01 and SPEC-04.
- [ ] `client/e2e/smoke/screen-spec-three-account-collaboration.spec.ts` — three-account collaboration evidence for SPEC-02 and SPEC-03.
- [x] `client/e2e/shared/screen-spec-e2e.ts` or equivalent helper extraction — stable screen-spec locators and actions.
- [x] Minimal stable test selectors on screen-spec UI primitives if semantic role/text locators are not enough.

## Execution Evidence

### 03-01 Automated Evidence

- **Command:** `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0`
  - **Result:** ✅ 1 passed on 2026-05-29.
  - **Covers:** SPEC-01 custom master definition, cross-screen instance placement, master label/color propagation, save/re-entry persistence, PNG download signature, PDF structural sanity.
- **Command:** `cd client && npm run test:unit -- screen-design`
  - **Result:** ✅ 363 tests passed on 2026-05-29.
- **Command:** `cd client && npm run test:unit -- screen-spec`
  - **Result:** ✅ 362 tests passed on 2026-05-29.
- **Command:** `cd client && npm run lint:docs`
  - **Result:** ✅ Passed on 2026-05-29.
- **Command:** `cd client && npm run build`
  - **Result:** ❌ blocked by pre-existing WBS issues outside Phase 3 scope:
    - `client/src/components/wbs/SortableWbsRow.tsx(332,21)` missing typed i18n key `wbs.validation.nameRequired`
    - `client/src/components/wbs/SortableWbsRowCells.tsx(84,3)` unused `milestoneName`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dev-profile browser QA over currently running `4503/9503` servers | SPEC-01, SPEC-02, SPEC-03, SPEC-04 | The user requested dev-profile manual QA in addition to automated test-profile E2E | Open the screen-spec document in dev profile, perform authoring/collaboration/export checks, and record browser target, account labels, document ID, screenshots or notes in `03-VERIFICATION.md`. |
| UX-strict lock/remote-state judgment | SPEC-03 | Some collaboration UX quality issues may not be fully captured by final-state assertions | During three-account QA, mark propagation delay, missing lock indicator, or confusing remote-state display as failure even if persisted content converges. |

---

## DomainValidationHook Policy

`ScreenSpecCollaborationPlugin.validationHook()` intentionally remains no-op for v1 closeout.

Validation safety for this phase is provided by:

- Frontend document normalization through `ensureScreenDesignDocumentStructure()`.
- Snapshot reads through `readScreenDesignDocument()`.
- Screen-spec mutation policy/applier unit coverage.
- Frontend and backend scope resolver coverage.
- Three-account browser E2E for the actual collaboration lifecycle.
- PNG/PDF browser download smoke checks for generated artifacts.

Execution must not add a Phase 3 TODO or backlog item for backend deep structure validation unless the user explicitly reopens scope.

---

## Validation Sign-Off

- [ ] All tasks have automated verification or Wave 0 dependencies.
- [ ] SPEC-01 through SPEC-04 each have at least one concrete evidence item.
- [ ] Three-account collaboration evidence exists.
- [ ] PNG and PDF export evidence both exist.
- [ ] Dev-profile manual QA is recorded in `03-VERIFICATION.md`.
- [ ] No watch-mode flags.
- [ ] `nyquist_compliant: true` set in frontmatter after evidence is complete.

**Approval:** pending
