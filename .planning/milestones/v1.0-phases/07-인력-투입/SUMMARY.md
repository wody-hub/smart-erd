---
phase: 07
plan: single
status: done
one_liner: "프로젝트 허브에 인력 투입 탭과 M/M 계획·실적·인건비 계산 흐름을 구현했다."
requirements-completed: [HR-01, HR-02, HR-03, HR-04]
---

# Phase 07 Summary

## Delivered

- Backend staffing foundation and API were delivered:
  - migration: `src/main/resources/db/migration/V20260422_01__phase7_project_staffing.sql`
  - domain/service/repository: `src/main/java/com/smarterd/domain/pm/staffing/**`
  - controller + DTO contract: `src/main/java/com/smarterd/api/project/ProjectStaffingController.java`, `src/main/java/com/smarterd/api/project/dto/staffing/**`
- Frontend staffing surface was delivered in the project hub:
  - tab wiring: `client/src/pages/diagram/DiagramsPage.tsx`
  - data contract/query invalidation: `client/src/api/staffingApi.ts`, `client/src/types/staffing.ts`, `client/src/constants/query-keys.ts`, `client/src/hooks/useProjectQueryInvalidation.ts`
  - UI components: `client/src/components/staffing/**`
  - i18n: `client/src/i18n/locales/ko/translation.json`, `client/src/i18n/locales/en/translation.json`
- QA re-review fix was included for actual-input atomic validation:
  - validator: `client/src/components/staffing/staffing-dialog-validation.ts`
  - dialog integration: `client/src/components/staffing/StaffingResourceDialog.tsx`
  - regression test: `client/test/unit/staffing-dialog-validation.test.ts`

## Verification

### Automated (2026-04-22)

- `./gradlew test` ✅ (`BUILD SUCCESSFUL in 18s`)
- `cd client && npm run lint:docs` ✅ (`Passed (3 files checked, no violations)`)
- `cd client && npm run build` ✅ (`✓ built in 19.35s`)
- `cd client && npm run test:unit` ✅ (`tests 319`, `pass 319`, `fail 0`)

Targeted closeout verification:

- `./gradlew test --tests 'com.smarterd.domain.pm.staffing.service.StaffingAllocationCalculatorTest' --tests 'com.smarterd.domain.pm.staffing.service.ProjectStaffingServiceTest' --tests 'com.smarterd.api.project.ProjectStaffingControllerMvcTest'` ✅ (`BUILD SUCCESSFUL in 2s`)
- `cd client && rm -rf .tmp-test && node ./node_modules/typescript/bin/tsc -p ./tsconfig.test.json && node ./scripts/rewrite-test-aliases.mjs && node --test ./.tmp-test/test/unit/staffing-matrix-window.test.js ./.tmp-test/test/unit/staffing-dialog-validation.test.js` ✅ (`tests 7`, `pass 7`, `fail 0`)

### Requirement/Smoke Coverage

- HR-01: 팀원별 투입 기간과 참여율 등록/수정
  - backend create/update/list/service/controller tests pass
  - frontend dialog validation and submit flows pass
- HR-02: 등급/월 단가 설정
  - grade/rate DTO and calculator range validation tests pass
  - dialog grade/rate input and i18n labels are wired
- HR-03: 계획 대비 실적 비교
  - monthly matrix window helper tests pass (36-month windowing 포함)
  - resource table + matrix planned/actual/delta rendering is implemented
- HR-04: M/M × 단가 인건비 자동 계산
  - calculator + summary aggregation tests pass
  - summary strip and row-level planned/actual cost rendering are wired

Documented smoke and QA evidence used for integration closeout:

- Backend closeout evidence from [RIS-181](/RIS/issues/RIS-181) confirms duplicate/non-member/validation/cost semantics and race-path duplicate mapping.
- Frontend QA re-review PASS from [RIS-184](/RIS/issues/RIS-184) confirms:
  - actual participation-only submit is blocked with `staffing.validation.actualDatePair`
  - regression coverage is present
  - build/unit suites pass after fix
- Viewer read-only behavior, duplicate create 409, non-member 403, invalid period/participation/rate 400 are covered by `ProjectStaffingControllerMvcTest`.

## Scope Note

- Phase 7 keeps staffing as the source of truth for M/M and labor cost.
- WBS assignee information remains separate and reference-only; no auto-sync/auto-create coupling was added between WBS and staffing rows.

## Follow-up

- No Phase 7 blocker remains for execution closeout.
- Non-blocking existing warning: Vite circular chunk warning (`feature-dsl` ↔ `feature-code-sync`) persists but does not affect Phase 7 staffing behavior or build success.
