---
phase: 6
slug: 간트-차트
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
---

# Phase 6 — Validation Strategy

> Nyquist audit for gantt-chart verification depth (Phase 6-12).

---

## Audit Scope

High-risk behaviors evaluated in this Nyquist pass:

- drag persistence correctness (persist only finalized date-range edits)
- mobile first-view presentation quality (390x844)
- load/error/read-only state completeness
- automation depth vs feature complexity

---

## Evidence Snapshot

| Area | Evidence | Result |
| --- | --- | --- |
| Build integrity | `cd client && npm run build` | ✅ PASS |
| Unit suite (workspace-safe invocation) | `cd client && node --input-type=module --eval "import { rmSync } from 'node:fs'; rmSync('.tmp-test', { recursive: true, force: true });" && tsc -p tsconfig.test.json && node ./scripts/rewrite-test-aliases.mjs && node --test .tmp-test/test/unit/*.test.js` | ✅ PASS (308/308) |
| Gantt focused unit coverage | `cd client && node --test .tmp-test/test/unit/gantt-adapter.test.js .tmp-test/test/unit/gantt-update-guards.test.js` | ✅ PASS (6/6) |
| Manual QA: acceptance + regression | [RIS-117](/RIS/issues/RIS-117) thread (including regression fix loop via [RIS-118](/RIS/issues/RIS-118)) | ✅ PASS |
| Manual UI re-review @ mobile width | [RIS-123](/RIS/issues/RIS-123) final re-review comment (`390x844`, timeline-first verified) | ✅ PASS |

---

## Requirement Coverage (Risk-Based)

### 1. Drag Persistence

Status: **PASS**

- `client/src/components/gantt/GanttTab.tsx` persists only on finalized `update-task` events (`event.inProgress` guard) and routes writes through existing `updateWbsItem` mutation.
- `client/src/components/gantt/gantt-update-guards.ts` rejects non-date and unchanged-range updates, which blocks progress-handle-only edits.
- Regression defect was previously detected and fixed through [RIS-118](/RIS/issues/RIS-118), then re-verified in [RIS-117](/RIS/issues/RIS-117).

### 2. Mobile Presentation (390x844)

Status: **PASS**

- Final re-review in [RIS-123](/RIS/issues/RIS-123) confirms tab rail fit and timeline-first first view at `390x844`.
- Current code reflects the fix set (`client/src/components/ui/tabs.tsx`, `client/src/components/gantt/GanttTab.tsx`, `client/src/pages/diagram/DiagramsPage.tsx`).

### 3. Load / Error / Read-Only States

Status: **PASS**

- Loading state: spinner gate when WBS/milestones are loading.
- Error state: gantt-specific recovery copy + retry action.
- Read-only state: `readonly={!canEdit}` + intercept guard + read-only hint text.

### 4. Automation Depth vs Complexity

Status: **PASS with non-blocking gaps**

- Strong unit coverage exists for gantt adapter and guard primitives.
- Manual QA evidence is substantial and includes explicit regression loop closure.
- Confidence is weaker at UI integration level: no gantt-specific component tests or Playwright flow for drag + mobile first view.

---

## Confidence Gaps (Non-Blocking)

1. **No gantt-specific E2E automation**
- Current `client/e2e` suite does not include gantt-tab flows.
- Risk: future regressions in drag lifecycle/mobile framing may rely on manual detection.

2. **No component-level test around `GanttTab` intercept wiring**
- Unit tests validate guard logic, but not end-to-end intercept -> mutation contract in the component.

3. **`npm run test:unit` path invocation mismatch in current Node runtime**
- In this workspace/runtime, `npm run test:unit` tries `node --test .tmp-test/test/unit` and fails module resolution.
- Workaround command above is green; this is a tooling sharp edge, not a Phase 6 feature blocker.

---

## Nyquist Verdict

**PASS**

Phase 6 verification depth is proportionate to the delivered gantt scope. High-risk behaviors were covered by a mix of focused unit tests and explicit manual QA/re-review loops, including regression closure and mobile viewport validation. Remaining concerns are real but non-blocking confidence gaps in automation breadth, not failures in shipped behavior.

---

## Recommended Follow-Up

- Add one Playwright smoke for gantt drag-end persistence + read-only drag block.
- Add one Playwright mobile (`390x844`) assertion for timeline-first first view.
- Harden `npm run test:unit` script to use an explicit glob (`.tmp-test/test/unit/*.test.js`) for runtime portability.
