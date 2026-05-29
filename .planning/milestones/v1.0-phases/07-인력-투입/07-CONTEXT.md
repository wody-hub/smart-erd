# Phase 7: 인력 투입 (M/M) - Context

**Gathered:** 2026-04-22
**Status:** Ready for UI phase
**Mode:** `$gsd-discuss-phase 7 --auto` fallback. The literal shell command was not installed, so the local GSD discuss workflow was applied manually with recommended defaults.

<domain>
## Phase Boundary

Phase 7 adds project-level staffing management for SI projects. Users can register team members' staffing periods, participation rates, staffing grades, and monthly rates, then compare planned M/M with actual M/M and see project labor cost totals calculated automatically.

This phase is separate from WBS effort estimation. WBS `estimatedMm` remains task effort, while Phase 7 staffing rows are person/resource allocations. WBS assignee data can inform the user, but staffing is the authoritative source for M/M and labor cost.

</domain>

<decisions>
## Implementation Decisions

### Staffing Data Ownership

- **D-01:** Store staffing grade and monthly rate on each project staffing row, not on the user profile or organization master data.
- **D-02:** Treat row-level grade/rate as a project contract snapshot. If a person's market rate or grade changes later, existing project rows should not silently change.
- **D-03:** Use team members as selectable resources. A staffing row must reference a user who belongs to the project team.
- **D-04:** Use staffing grades `JUNIOR`, `MIDDLE`, `SENIOR`, `EXPERT` with Korean labels `초급`, `중급`, `고급`, `특급`.
- **D-05:** Monthly rate is KRW integer amount. Negative rates are invalid.

### Plan vs Actual Entry Model

- **D-06:** v1 uses period and participation-rate entry for both plan and actual values.
- **D-07:** Planned values and actual values are separated on the staffing row: planned period/participation and actual period/participation.
- **D-08:** Do not add timesheets, daily/hourly work logs, or month-by-month direct entry in Phase 7.
- **D-09:** Backend owns M/M and cost calculations. UI sends input fields and renders calculated response values.

### Duplicate and Multi-Assignment Policy

- **D-10:** v1 allows one staffing row per `(project, user)`.
- **D-11:** A single person cannot have multiple overlapping or split staffing intervals in Phase 7.
- **D-12:** Multi-interval staffing belongs to a later capacity/cost-management phase if it becomes necessary.

### WBS Relationship

- **D-13:** Do not auto-create staffing rows from WBS assignees in Phase 7.
- **D-14:** Do not keep WBS assignee and staffing row in automatic two-way sync.
- **D-15:** Staffing may show WBS assignee information as read-only context later, but the Phase 7 source of truth is manually managed project staffing rows.
- **D-16:** WBS `estimatedMm` remains work estimate, not staffing actuals or cost input.

### M/M and Cost Calculation

- **D-17:** Partial months are calculated by calendar-day proration per overlapped month.
- **D-18:** Monthly contribution formula: `(overlap days in month / days in that calendar month) * participationRate / 100`.
- **D-19:** Total M/M is the sum of monthly contributions, rounded `HALF_UP` to 2 decimal places.
- **D-20:** Cost uses the rounded M/M shown to users multiplied by the KRW monthly rate, rounded `HALF_UP` to a KRW integer.
- **D-21:** Calculate planned M/M/cost and actual M/M/cost independently so variance can be shown directly.
- **D-22:** Use backend `BigDecimal` for calculation and deterministic unit tests for partial-month, participation-rate, rounding, and zero/blank actual cases.

### UI and Workflow

- **D-23:** Add a `staffing` tab to the existing project hub next to WBS and Gantt.
- **D-24:** Use a dense operational table/matrix layout, not a marketing-style page or decorative dashboard.
- **D-25:** Provide an add/edit dialog for staffing rows using existing table, dialog, Select, Button, toast, and React Query patterns.
- **D-26:** Show summary totals for planned M/M, actual M/M, variance, planned cost, and actual cost.
- **D-27:** Show a matrix/table that compares planned and actual allocation by member and month.

### Excluded Scope

- **D-28:** Exclude salary/payroll integration.
- **D-29:** Exclude accounting/ERP integration.
- **D-30:** Exclude timesheet or hourly work logging.
- **D-31:** Exclude non-labor cost categories such as expenses, outsourcing, hardware, or software licenses.
- **D-32:** Exclude global grade/rate master management.
- **D-33:** Exclude WBS-driven auto-staffing.

### the agent's Discretion

- Exact backend persistence shape for derived M/M/cost values, as long as the API output is deterministic and tests lock calculation behavior.
- Exact row density, fixed columns, horizontal overflow behavior, and summary strip composition.
- Whether the monthly matrix starts with project business period, staffing min/max period, or visible staffed months, as long as empty projects have a clear state and real staffing rows are visible without layout breakage.
- Exact copy for empty states, toasts, and validation messages, provided Korean and English i18n are both covered.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and Phase Scope

- `.planning/PROJECT.md` - SI project management product boundary, PM expansion roadmap, and out-of-scope constraints.
- `.planning/REQUIREMENTS.md` - HR-01 through HR-04 and v1 out-of-scope notes for timesheets, payroll, and cost categories.
- `.planning/ROADMAP.md` - Phase 7 goal, dependencies, success criteria, and UI hint.
- `.planning/STATE.md` - Current phase state and Phase 6.1 closeout notes.
- `[RIS-170 plan](/RIS/issues/RIS-170#document-plan)` - Phase 7 work plan and actual GSD sequence that requires UI phase after discussion.

### Prior Phase Decisions

- `.planning/phases/06.1-wbs-작업공간-확장/06.1-CONTEXT.md` - WBS assignee and dedicated workspace decisions; explicitly defers M/M and cost to Phase 7.
- `.planning/phases/06.1-wbs-작업공간-확장/06.1-DISCUSSION-LOG.md` - Alternatives considered for WBS assignee UX and why staffing was left for Phase 7.
- `.planning/phases/06.1-wbs-작업공간-확장/06.1-UI-SPEC.md` - Operational WBS workspace UX that Phase 7 should visually align with.
- `.planning/phases/06.1-wbs-작업공간-확장/SUMMARY.md` - Phase 6.1 implementation closeout and available WBS inputs.

### Existing Backend Contracts

- `src/main/java/com/smarterd/domain/pm/common/ProjectContextLoader.java` - Reusable PM project/team permission loader.
- `src/main/java/com/smarterd/domain/pm/wbs/entity/WbsItem.java` - WBS `assignee` and `estimatedMm` fields that must stay semantically separate from staffing.
- `src/main/java/com/smarterd/domain/pm/wbs/service/WbsService.java` - Existing PM service style, team-member validation, and WBS result mapping.
- `src/main/java/com/smarterd/api/project/WbsController.java` - Existing nested project API route convention.
- `src/main/java/com/smarterd/domain/team/repository/TeamMemberRepository.java` - Team membership validation/query APIs.

### Existing Frontend Patterns

- `client/src/pages/diagram/DiagramsPage.tsx` - Project hub tab shell where the staffing tab should be added.
- `client/src/components/project/BusinessOverviewTab.tsx` - Summary/editing pattern and currency/date utility usage.
- `client/src/components/wbs/WbsWorkspaceContent.tsx` - Operational table, mutation, invalidation, empty state, and member-fetch pattern.
- `client/src/components/wbs/WbsItemFormDialog.tsx` - Select/dialog form pattern with team member options.
- `client/src/api/teamApi.ts` - `fetchMembers(teamId)` contract for member selection.
- `client/src/constants/query-keys.ts` - React Query key hierarchy to extend with `staffing`.
- `client/src/lib/format.ts` - `formatCurrency()`, date formatting, and date validation helpers.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ProjectContextLoader`: use `load(..., false)` for staffing reads and `load(..., true)` for create/update/delete.
- `TeamMemberRepository.existsByTeamAndUser(...)`: validates selected staffing user belongs to the team.
- `fetchMembers(teamId)` and `queryKeys.teams.members(teamId)`: already support member selection in WBS dialogs.
- `formatCurrency(amount)`: should be reused for planned/actual labor cost display.
- `BusinessOverviewTab` and `WbsWorkspaceContent`: provide existing patterns for query loading, mutation toasts, empty states, operational table layout, and project hub integration.
- `useProjectQueryInvalidation(teamId, projectId)`: useful for invalidating related project overview and PM data after staffing mutations.

### Established Patterns

- PM feature endpoints are nested under `/api/teams/{teamId}/projects/{projectId}/...`.
- Backend controllers are thin; domain services own validation and calculations.
- Backend exceptions use localized message codes, not hard-coded error text.
- Java domain services use class-level `@Transactional(readOnly = true)` and method-level `@Transactional` for writes.
- Frontend API functions require JSDoc and domain-specific type files.
- React Query keys mirror URL hierarchy under `queryKeys`.
- UI uses i18n, semantic Tailwind token classes, shadcn/Radix primitives, lucide icons, and toast-based errors.

### Integration Points

- Add a new backend package under `domain/pm/staffing` and controller/DTOs under `api/project`.
- Add a Flyway migration for `project_staffing` with project/user references, grade, monthly rate, plan fields, and actual fields.
- Add `client/src/types/staffing.ts`, `client/src/api/staffingApi.ts`, and `queryKeys.staffing.all(teamId, projectId)`.
- Add the project hub `staffing` tab in `DiagramsPage` beside WBS/Gantt.
- Add `client/src/components/staffing/*` components for summary strip, table/matrix, and row dialog.
- Add Korean and English translation keys for grade labels, validation, empty states, toasts, and table headings.

</code_context>

<specifics>
## Specific Ideas

- Staffing rows should feel like project contract/resource allocation rows, not user profile records.
- Users should be able to reconcile displayed numbers: the rounded M/M visible in the table is the same M/M used for visible KRW cost.
- Empty state should lead directly to adding the first staffing row.
- The matrix should favor stable columns and horizontal overflow over shrinking text.
- Staffing data is useful context for Phase 8 issue tracker but should not block issue tracker design.

</specifics>

<deferred>
## Deferred Ideas

- Organization-wide grade/rate master tables.
- Multiple staffing intervals per person in one project.
- Monthly direct override grid for plan/actual values.
- Daily/hourly timesheet entry.
- Payroll, salary, accounting, ERP, or external HR integration.
- Non-labor cost categories and full budget management.
- Automatic staffing generation from WBS assignees.
- WBS/staffing bidirectional sync.

</deferred>

---

_Phase: 07-인력-투입_
_Context gathered: 2026-04-22_
