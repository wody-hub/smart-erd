---
phase: 7
slug: 인력-투입
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
---

# Phase 07 - Validation Strategy

> Nyquist audit for project staffing delivery (HR-01, HR-02, HR-03, HR-04) in RIS-186 closeout.

---

## Audit Scope

High-risk behaviors reviewed in this validation pass:

- backend M/M and labor-cost calculation determinism (proration, rounding, cost conversion)
- staffing CRUD/access control and validation error semantics
- project hub staffing UI integrity (summary/table/dialog/matrix) and matrix month-window behavior
- regression closure for actual-input atomic validation (`actualDatePair`) and Phase 7 i18n wiring

---

## Evidence Snapshot

| Area | Evidence | Result |
| --- | --- | --- |
| Backend full regression | `./gradlew test` | PASS (`BUILD SUCCESSFUL in 13s`) |
| Backend staffing-targeted suite | `./gradlew test --tests 'com.smarterd.domain.pm.staffing.service.StaffingAllocationCalculatorTest' --tests 'com.smarterd.domain.pm.staffing.service.ProjectStaffingServiceTest' --tests 'com.smarterd.api.project.ProjectStaffingControllerMvcTest'` | PASS |
| Frontend production build | `cd client && npm run build` | PASS (`built in 28.04s`) |
| Frontend unit suite | `cd client && npm run test:unit` | PASS (`tests 319`, `pass 319`, `fail 0`) |
| Frontend docs/lint contract | `cd client && npm run lint:docs` | PASS (`Passed (3 files checked, no violations)`) |
| Phase 7 focused FE regression | `cd client && rm -rf .tmp-test && node ./node_modules/typescript/bin/tsc -p ./tsconfig.test.json && node ./scripts/rewrite-test-aliases.mjs && node --test ./.tmp-test/test/unit/staffing-matrix-window.test.js ./.tmp-test/test/unit/staffing-dialog-validation.test.js` | PASS (`tests 7`, `pass 7`, `fail 0`) |
| UI contract re-review | `.planning/phases/07-인력-투입/07-UI-REVIEW.md` | PASS (`Final Overall: 23/24`) |
| Phase execution closeout summary | `.planning/phases/07-인력-투입/SUMMARY.md` | PASS |

---

## Requirement Coverage (HR-01~HR-04)

### HR-01 - 팀원별 투입 기간/참여율 등록 및 수정

Status: **PASS**

- Create/Update/List/Delete behavior and validation are covered by staffing service/controller tests.
- Dialog validation includes planned/actual date ordering, actual-input atomicity, and participation bounds.

### HR-02 - 인력 등급/월 단가 설정

Status: **PASS**

- Backend DTO/domain path enforces grade/rate constraints.
- UI grade/rate inputs and ko/en translations are wired and exercised by unit/build validation.

### HR-03 - 계획 대비 실적 비교

Status: **PASS**

- Backend response includes planned/actual/delta and monthly allocations.
- Matrix month-window helper tests verify long-range behavior (36-month scenario).

### HR-04 - M/M × 단가 인건비 자동 계산

Status: **PASS**

- `StaffingAllocationCalculatorTest` and service/controller integration paths are green in this run.
- Summary strip and row-level cost rendering are included in reviewed UI surface.

---

## Manual-Backed Evidence

These behaviors remain primarily validated by documented review/smoke evidence:

- mobile-width matrix scroll/focus and local overflow containment
- neutral negative-delta color contract and icon action tooltip contract
- staffing tab project-hub IA behavior across loading/error/empty/read-only states

Evidence source:

- `.planning/phases/07-인력-투입/07-UI-REVIEW.md`
- `.planning/phases/07-인력-투입/SUMMARY.md`

---

## Confidence Gaps (Non-Blocking)

1. No dedicated Playwright E2E flow yet for staffing CRUD + matrix window interaction.
2. Frontend relies on unit/build coverage plus UI review evidence; browser automation breadth can be improved in follow-up work.
3. Vite circular chunk warning (`feature-dsl` ↔ `feature-code-sync`) persists but is pre-existing and not Phase 7 staffing-specific.

---

## Nyquist Verdict

**PASS**

Phase 7 risk is acceptable for closeout. Core backend calculations, API behavior, frontend contracts, and targeted regressions are all green in this validation run, and UI contract review is already closed with PASS.

This issue can proceed to closeout/review completion.
