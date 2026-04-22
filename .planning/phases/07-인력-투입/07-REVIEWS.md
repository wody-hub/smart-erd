---
phase: "07"
reviewers: [gemini, codex]
review_attempted: [gemini, claude, codex]
reviewed_at: "2026-04-22T02:23:00Z"
plans_reviewed:
  - .planning/phases/07-인력-투입/07-01-PLAN.md
---

# Cross-AI Plan Review — Phase 07

## Gemini Review

# Phase 7: 인력 투입 (M/M) 구현 계획 리뷰

스마트 ERD 플랫폼의 SI 프로젝트 관리 확장 중 핵심인 **인력 투입(M/M) 및 인건비 관리** 단계에 대한 구현 계획을 검토한 결과입니다.

## 1. Summary
본 계획은 SI 프로젝트의 예산 및 리소스 관리의 핵심인 M/M(Man-Month) 계산과 인건비 집계를 자동화하기 위한 포괄적이고 정밀한 설계를 담고 있습니다. 특히 **백엔드 중심의 정밀한 일할 계산(Proration) 로직**과 **WBS 담당자 데이터와의 명확한 도메인 분리**를 통해 데이터 무결성을 확보한 점이 우수합니다. 기존 프로젝트 허브의 UI 패턴을 일관되게 확장하면서도, 요약 지표(Summary Strip)와 비교 매트릭스(Monthly Matrix)를 통해 복잡한 데이터를 효과적으로 시각화하고 있습니다.

## 2. Strengths
- **정밀한 계산 모델:** `BigDecimal`과 `HALF_UP` 반올림을 사용한 일할 계산 로직(`overlapDays / daysInMonth`)은 윤년(Leap Year) 및 월별 일수 차이를 완벽히 대응하며, SI 업계의 관행적인 산출 방식과 일치합니다.
- **도메인 격리:** WBS의 `estimatedMm`(작업 공수)과 인력 투입의 `staffing row`(리소스 할당)를 분리하여, 일정 관리와 비용 관리의 목적 차이를 명확히 하고 데이터 간섭을 방지했습니다.
- **계산 결과의 일관성:** 사용자가 화면에서 보는 반올림된 M/M 값을 기준으로 인건비를 계산하도록 설계(D-20)하여, 소수점 오차로 인한 사용자의 계산 불신을 원천 차단했습니다.
- **완성도 높은 UI/UX 설계:** 전용 탭, 요약 스트립, 리소스 테이블, 그리고 시각적 비교를 위한 매트릭스 뷰까지 이어지는 계층적 정보 구조가 안정적입니다.
- **검증 중심의 작업 설계:** 계산 엔진(`StaffingAllocationCalculator`)에 대한 TDD 접근과 백엔드/프론트엔드 통합 테스트 계획이 구체적입니다.

## 3. Concerns
- **매트릭스 가로 확장성 (Medium):** 프로젝트 기간이 길어질 경우(예: 24개월 이상) 매트릭스 테이블의 가로 길이가 극단적으로 길어질 수 있습니다. identity column(성명)의 sticky 처리가 필수적입니다.
- **데이터 입력 편의성 (Low):** 계획(Planned) 기간과 실제(Actual) 기간이 동일한 경우가 많음에도 불구하고, 모든 필드를 수동으로 다시 입력해야 하는 번거로움이 발생할 수 있습니다.
- **팀 멤버 변경 대응 (Low):** 프로젝트 도중 팀 멤버가 삭제되거나 팀에서 나갈 경우, 기존 staffing row의 이력 보존 정책이 명확해야 합니다. (계획상으로는 `ON DELETE CASCADE` 또는 `SET NULL`에 대한 언급이 있으나 비즈니스 영향도 확인 필요)
- **성능 (Low):** 매트릭스 렌더링 시 모든 멤버의 월별 데이터를 한꺼번에 로드하므로, 대규모 프로젝트(인원 100명 이상) 시 초기 렌더링 부하가 발생할 수 있습니다.

## 4. Suggestions
- **"계획을 실적으로 복사" 기능:** staffing dialog에서 'Copy Planned' 버튼을 추가하여, 계획된 기간과 참여율을 실제(Actual) 필드에 즉시 채울 수 있게 하면 사용자 경험이 크게 개선될 것입니다.
- **매트릭스 Sticky Column 강화:** `StaffingMatrixTable` 구현 시 첫 번째 컬럼(성명/등급)은 가로 스크롤 시에도 항상 좌측에 고정(sticky)되도록 CSS 처리를 엄격히 적용해야 합니다.
- **M/M 소수점 가독성:** 2자리 소수점 표시 시 `.00`과 같이 의미 없는 소수점은 가독성을 위해 흐리게 처리하거나, 정수일 경우 정수만 표시하는 유틸리티 고려가 필요합니다.
- **과거/현재/미래 가이드 라인:** 매트릭스에서 '현재 월'에 해당하는 컬럼에 세로 강조선을 넣어 시각적 기준점을 제공하는 것을 추천합니다.

## 5. Risk Assessment: LOW
- **근거:**
    - 계산 로직이 수학적으로 명확히 정의되어 있고 백엔드에서 소유하므로 프론트엔드 오차 리스크가 낮습니다.
    - 기존 WBS(Phase 6.1)에서 검증된 기술 스택(React Query, shadcn/ui Table)을 재사용합니다.
    - 복잡한 외부 시스템(인사/급여) 연동을 과감히 제외하여 범위 확산 리스크를 통제했습니다.
    - SI 도메인에 대한 높은 이해도를 바탕으로 한 정책 결정(D-01 ~ D-33)이 논리적입니다.

---
본 계획은 즉시 실행 가능(Executable)한 수준으로 판단되며, 위 제안사항을 구현 단계에서 참고한다면 더욱 완성도 높은 결과물이 도출될 것으로 기대됩니다.

---

## Claude Review (Attempted)

Claude CLI returned an access error and did not provide a review response.

```text
Your organization does not have access to Claude. Please login again or contact your administrator.
```

---

## Codex Review

## Summary

The plan is strong and executable. It maps Phase 7’s requirements to concrete backend schema/API work, frontend contracts, UI components, tests, and closeout steps. The biggest risks are not scope coverage, but implementation detail gaps around validation consistency, race conditions, membership semantics, API/date serialization, and keeping the UI from accidentally reintroducing frontend-side calculation logic.

## Strengths

- Clear phase boundary: staffing is separate from WBS effort, WBS assignees, payroll, timesheets, and global rate masters.
- Backend-owned calculation contract is well specified, including partial-month proration, rounding, blank actuals, and cost based on rounded M/M.
- Good dependency order: schema/calculator → service/API → frontend contract → UI → verification.
- The plan includes both unit-level calculation tests and service/controller tests.
- One-row-per-project-member rule is enforced at both schema and service levels.
- UI plan matches the requested operational table/matrix style and avoids direct matrix editing.
- i18n, React Query keys, invalidation, and project hub integration are called out explicitly.
- Closeout criteria tie implementation back to HR-01 through HR-04.

## Concerns

- **HIGH:** Duplicate create has a race condition. The service checks `existsByProjectAndUser`, but concurrent requests can still hit the DB unique constraint. The plan should require catching unique constraint/DataIntegrityViolation exceptions and mapping them to `ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER`.

- **HIGH:** Team membership validation semantics are underspecified. “Belongs to the team” may need to distinguish active members from invited/removed/pending members depending on existing `TeamMemberRepository` behavior. If inactive users can be selected, staffing may reference invalid resources.

- **MEDIUM:** API URL convention needs confirmation. Backend route includes `/api/teams/...`, while frontend API functions list `/teams/...`. This may be correct if the API client has `/api` as base URL, but the plan should explicitly say to follow existing `wbsApi.ts` URL style.

- **MEDIUM:** Validation may become split and inconsistent across DB checks, entity invariants, DTO annotations, and frontend validation. The plan is good, but it should explicitly require service/controller tests for invalid planned date order, partial actuals, invalid actual date order, negative rate, and participation bounds.

- **MEDIUM:** Cost uses `long` after BigDecimal multiplication. For normal KRW rates this is fine, but there is no upper bound on `monthlyRate` or computed cost. A very large value can overflow or fail late. Add a practical max or use explicit checked conversion.

- **MEDIUM:** `UpdateProjectStaffingRequest` locks `userId`, which fits the one-row policy, but the repository method `existsByProjectAndUserAndIdNot` becomes unused unless future user reassignment exists. That is minor, but it can signal ambiguity.

- **MEDIUM:** Monthly matrix month range is based on union of populated allocation months. This works, but empty actual periods will only show planned months. If the desired comparison period should include project business dates, the plan leaves that discretionary and may cause UX disagreement later.

- **LOW:** Migration timestamps/audit columns are nullable in the plan. If `BaseAuditEntity` or existing migrations expect non-null/default behavior, this can drift from local conventions.

- **LOW:** The frontend unit test file is listed in `files_modified`, but Task 3 says not to add it if no helper is introduced. That inconsistency can confuse execution agents.

- **LOW:** The plan does not explicitly mention OpenAPI/API docs or endpoint discoverability, if the project maintains them.

## Suggestions

- Add a required service test for DB-level duplicate collision or explicitly catch unique constraint violations on create.
- Clarify member eligibility: use only active/current team members if the domain supports member status.
- Add controller validation tests for all invalid request shapes, not only invalid actual pair.
- Add an explicit frontend API note: “Use the same base URL convention as `wbsApi.ts`.”
- Add a practical monthly-rate upper bound if the existing domain has money constraints; otherwise ensure BigDecimal-to-long conversion is checked.
- Require `@Enumerated(EnumType.STRING)` on `ProjectStaffing.grade`.
- Make matrix month policy explicit: union of planned and actual allocation months is the v1 contract, unless project business period exists and should define the range.
- Remove `client/test/unit/staffing-calculations.test.ts` from `files_modified` unless a display helper is definitely planned.
- Add an integration/smoke case for viewer permissions: GET allowed, POST/PUT/DELETE denied.
- Require regression check that WBS `estimatedMm` and assignee APIs remain untouched.

## Risk Assessment

**Overall risk: MEDIUM.**

The plan is complete enough to achieve HR-01 through HR-04, and the architecture aligns well with existing PM/WBS patterns. Risk is mainly in implementation precision: concurrent duplicate handling, validation consistency, membership status, and financial rounding/overflow details. None of these require changing the phase scope, but they should be tightened before execution to avoid subtle production defects.

---

## Consensus Summary

Phase 7 plan quality is generally strong and executable, with both completed reviewers agreeing that scope boundaries and the backend-first calculation contract are clear. The shared risk theme is not missing features but implementation rigor in edge conditions and scaling behavior.

### Agreed Strengths

- Scope boundaries are explicit: staffing stays separate from WBS effort and excludes payroll/timesheet/ERP domains.
- Backend-owned M/M and labor-cost calculation contract is precise and testable.
- Work decomposition/order is practical: schema + calculator first, then service/API, then frontend/UI, then verification/closeout.
- UI structure (summary strip + resource table + read-only matrix) aligns with Phase 7 goals.

### Agreed Concerns

- Member lifecycle handling needs explicit policy and tests: what happens when a team member is inactive/removed after staffing rows exist.
- Matrix scalability/performance risk exists for long project durations and/or large team sizes.
- Validation hardening should be explicit across API/service/DB boundaries to avoid edge-case drift.

### Divergent Views

- Codex flags DB race-condition handling for duplicate creates as HIGH priority; Gemini focuses more on UX/operability concerns (copy planned->actual, matrix readability).
- Codex emphasizes backend validation/overflow/route-contract risks; Gemini emphasizes usability improvements and visual table ergonomics.

## Recommended Planner Action

Run a plan revision pass with review feedback incorporated:

```bash
$gsd-plan-phase 7 --reviews
```
