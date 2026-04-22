# Phase 07 User Verification (RIS-187)

**Date:** 2026-04-22
**Issue:** RIS-187
**Scope:** User-perspective/UAT verification for Phase 7 staffing workflows (HR-01 ~ HR-04)

---

## Command Path Note

The requested command `$gsd-verify-work 7` is not available in this runtime (`command -v gsd-verify-work` returned no match).

Per ticket instruction, the documented equivalent verification workflow was executed.

---

## Executed Evidence

### 1) Automated regression baseline

- `./gradlew test --rerun-tasks` -> PASS (`BUILD SUCCESSFUL in 18s`)
- `cd client && npm run build` -> PASS (`✓ built in 21.86s`)
- `cd client && npm run test:unit` -> PASS (`tests 319`, `pass 319`, `fail 0`)
- `cd client && npm run lint:docs` -> PASS (`Passed (3 files checked, no violations)`)

### 2) Phase 7 targeted verification

- `./gradlew test --tests 'com.smarterd.domain.pm.staffing.service.StaffingAllocationCalculatorTest' --tests 'com.smarterd.domain.pm.staffing.service.ProjectStaffingServiceTest' --tests 'com.smarterd.api.project.ProjectStaffingControllerMvcTest'` -> PASS
- `cd client && rm -rf .tmp-test && node ./node_modules/typescript/bin/tsc -p ./tsconfig.test.json && node ./scripts/rewrite-test-aliases.mjs && node --test ./.tmp-test/test/unit/staffing-matrix-window.test.js ./.tmp-test/test/unit/staffing-dialog-validation.test.js` -> PASS (`tests 7`, `pass 7`, `fail 0`)

### 3) Existing UI/UAT audit evidence referenced

- `.planning/phases/07-인력-투입/07-UI-REVIEW.md` (Final Verdict: PASS, 23/24)
- Browser evidence in that review: Playwright Chromium mobile fixture confirms:
  - staffing tab render and hierarchy
  - local matrix overflow containment (no page-level horizontal overflow)
  - matrix scroll focus visibility
  - read/write staffing actions and state coverage (loading/error/empty/read-only/create/edit/delete/windowed matrix)

---

## UAT Coverage Matrix

| User-flow checkpoint | Evidence | Result |
| --- | --- | --- |
| Staffing tab access from project hub | `DiagramsPage.tsx` tab wiring + UI review IA verification | PASS |
| Create staffing row | `ProjectStaffingControllerMvcTest` create route + service create tests | PASS |
| Edit staffing row | `ProjectStaffingControllerMvcTest` update route + service update test | PASS |
| Delete staffing row | `ProjectStaffingControllerMvcTest` delete route + service delete/not-found test | PASS |
| Planned vs actual comparison visibility | Summary/list response shape + matrix/dialog tests + UI review | PASS |
| Cost summary visibility (planned/actual labor cost) | calculator/service/controller tests + summary strip audit | PASS |
| Read-only/viewer behavior | `ProjectStaffingControllerMvcTest` viewer GET allowed, write denied (403) | PASS |
| Validation errors (actual date pair/order, participation/rate bounds, duplicate/member rules) | controller/service/calculator tests + dialog validation unit test | PASS |
| Matrix window/overflow behavior | `staffing-matrix-window.test` + Playwright mobile evidence in UI review | PASS |

---

## Requirement Verdict (HR-01 ~ HR-04)

- **HR-01:** PASS (member staffing registration/edit/delete behavior verified)
- **HR-02:** PASS (grade/monthly-rate path and validation verified)
- **HR-03:** PASS (planned vs actual compare path and matrix window behavior verified)
- **HR-04:** PASS (M/M × monthly rate labor-cost calculation verified)

---

## Risks / Gaps

No blocking gap found for Phase 7 closeout.
Known non-blocking note remains unchanged: Vite circular chunk warning (`feature-dsl` <-> `feature-code-sync`) observed during build.

---

## Final Verdict

**PASS - RIS-187 can be closed.**
