---
phase: 07
slug: 인력-투입
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-22
reviewed_at: 2026-04-22
source_issue: RIS-177
workflow_fallback: "Manual Codex equivalent of $gsd-ui-phase 7; local workflow is a Claude/GSD orchestration, not a standalone shell command in this runtime."
---

# Phase 07 - UI Design Contract: 인력 투입 (M/M)

> Visual and interaction contract for project staffing, planned/actual M/M comparison, and labor-cost visibility. This is the frozen UI input for `$gsd-plan-phase 7`.

---

## Design System

| Property | Value |
|----------|-------|
| App shell | Existing project hub in `DiagramsPage` with `Header` workspace context |
| Component library | Radix UI via local shadcn/ui-style primitives |
| Component registry | No `components.json`; use existing local primitives only |
| Icon library | `lucide-react` |
| Data surface | `client/src/components/ui/table.tsx` plus local overflow wrapper |
| Dialog surface | `client/src/components/ui/dialog.tsx`, `Input`, `Select`, `Label`, `Button` |
| Feedback | `sonner` toasts, `WorkspaceEmptyState`, React Query loading/error patterns |
| Formatting | `formatCurrency()` for KRW, date helpers from `client/src/lib/format.ts` |

No new visual language is introduced in this phase. Staffing is a dense project-management work surface and must align with Phase 6.1 WBS and Phase 6 Gantt project-hub patterns.

## Scope Freeze

This UI phase fixes the following boundaries:

1. Add a `staffing` tab to the project hub beside `documents`, `overview`, `wbs`, and `gantt`.
2. Staffing rows are manually managed project resource-allocation rows.
3. One staffing row represents one project team member in Phase 7.
4. Grade and monthly rate are stored and edited on the staffing row.
5. Planned and actual values are entered as period plus participation rate.
6. M/M and labor cost are calculated by the backend and rendered by the UI.
7. The monthly matrix is a comparison/read surface, not a direct month-by-month input grid.
8. WBS assignee data is reference context only and never the staffing source of truth.

Out of scope:

- payroll, salary, HR, accounting, ERP, and timesheet integration
- non-labor cost categories
- organization-wide grade/rate master management
- multiple staffing intervals per member
- monthly direct override editing
- automatic staffing creation from WBS assignees
- WBS/staffing two-way sync

## Screen Inventory

### 1. Project Hub `staffing` Tab

Purpose: primary Phase 7 working surface inside the existing project hub.

- Add `staffing` as a first-class tab in `DiagramsPage`.
- Position it after `gantt` unless implementation constraints require `wbs / gantt / staffing` grouping; keep staffing visually adjacent to other PM tabs.
- Use project-planning hero framing, not document-hub copy.
- Hero/meta copy must say resource allocation, M/M, and labor cost rather than documents.
- The hub container for active staffing should use `max-w-none`, matching wide WBS/Gantt treatment.

### 2. Staffing Summary Strip

Purpose: immediate totals for project-level planned vs actual staffing.

- Location: top of `StaffingTab`, below the tab header/toolbar and above the main resource table.
- Density: one horizontal strip on desktop; wrapped grid on tablet/mobile.
- Required metrics:
  1. Planned M/M
  2. Actual M/M
  3. Delta M/M
  4. Planned labor cost
  5. Actual labor cost
- Each metric must include label, value, and compact helper/status text where useful.
- Numeric values use tabular numbers.
- KRW values use `formatCurrency()` and no abbreviated `M`, `K`, or `억` shorthand in v1.

### 3. Resource Table

Purpose: canonical row management surface for staffing resources.

- Component owner: `client/src/components/staffing/StaffingTab.tsx` can delegate to `StaffingResourceTable`.
- Data owner: `GET /api/teams/{teamId}/projects/{projectId}/staffing` response.
- Row actions open the dialog, delete a staffing row, and optionally focus the row in the matrix.
- No inline cell editing in Phase 7.

### 4. Resource Create/Edit Dialog

Purpose: only mutation surface for staffing rows.

- Component owner: `client/src/components/staffing/StaffingResourceDialog.tsx`.
- Use existing Radix dialog and field layout patterns from `WbsItemFormDialog`.
- The dialog must work for both create and edit.
- Create mode selects a team member; edit mode keeps the selected member visible and may lock member selection if backend unique policy would make member changes ambiguous.

### 5. Monthly Matrix

Purpose: compare planned and actual M/M by member and month.

- Component owner: `client/src/components/staffing/StaffingMatrixTable.tsx`.
- It appears below the resource table on desktop and mobile.
- It is read/calculation display only in Phase 7.
- It must keep member identity fixed while month columns scroll horizontally.

## Information Architecture

### Project Hub Navigation

Project hub tab rail:

1. Documents
2. Business overview
3. WBS
4. Gantt
5. Staffing

Tab icon:

- Use `UsersRound` or `UserRoundCog` from `lucide-react`.
- Do not use decorative finance/chart icons as the primary staffing tab marker; staffing is people-first, with cost as a derived view.

Active tab behavior:

- Switching away from `documents` closes document creation dialogs, as the current hub already does.
- Staffing tab does not get a dedicated route in Phase 7.
- The tab must be directly reachable from local tab state and may be URL-backed later.

### Project-Hub Hero Contract

For active staffing mode:

- `workspaceContext.section`: `projects`
- `tone`: `projects`
- eyebrow: `staffing.tab.title`
- description: `staffing.section.description`
- meta: `workspace.projectHub.staffingMeta`
- no document-count metadata

Focal point:

- The first visual anchor inside the working area is the summary strip.
- The second visual anchor is the resource table.
- The matrix is a supporting verification view, not the first focal point.

## Layout Contract

### Overall Shape

`StaffingTab` structure:

1. compact section header and toolbar
2. summary strip
3. resource table
4. monthly matrix

Use `space-y-6` between major blocks.

Do not place the entire staffing workflow inside a decorative nested card. Each block may use one operational surface, but page sections should not become cards inside cards.

### Header and Toolbar

Left:

- title: `staffing.section.title`
- description: `staffing.section.description`
- optional short read-only hint when `canEdit === false`

Right:

- primary CTA: `Add staffing row`
- secondary action: `Refresh staffing`
- optional filter controls after API data exists

Toolbar behavior:

- Buttons wrap on narrow widths.
- Refresh is available in read-only mode.
- Create is hidden or disabled in read-only mode with explicit read-only copy elsewhere on the screen.
- Do not add search/filter controls until there are at least two useful filter dimensions; Phase 7 may include grade and member filters if implementation cost is small.

### Summary Strip Layout

Desktop:

- five equal columns when width allows
- each metric uses a compact operational panel with `rounded-lg`, `border-border`, `bg-card`, and `shadow-operational` only if consistent with neighboring blocks

Tablet/mobile:

- two columns when possible
- single column below narrow mobile widths
- no horizontal scroll for the summary strip

Metric styling:

- planned values use neutral foreground
- actual values use neutral foreground
- delta uses semantic color only for variance direction and must include `+` or `-` text
- cost cards may use `brand-secondary` for a small label/icon accent only
- destructive color is not used for negative delta unless the copy explicitly says overrun or shortage

### Resource Table Layout

The resource table is the primary management surface.

Columns:

| Column | Width | Contract |
|--------|-------|----------|
| Member | 220px | name primary, loginId/email muted secondary when available |
| Grade | 120px | 초급/중급/고급/특급 label; enum hidden from user |
| Monthly rate | 150px | KRW integer, tabular numbers |
| Planned period | 220px | start-end date or empty state |
| Planned % | 120px | participation rate with `%` |
| Planned M/M | 120px | backend-calculated, 2 decimals |
| Actual period | 220px | start-end date or `Not entered` |
| Actual % | 120px | participation rate or empty state |
| Actual M/M | 120px | backend-calculated, 2 decimals or `-` |
| Delta | 120px | actual minus planned, signed, 2 decimals |
| Cost | 190px | planned and actual KRW in stacked compact text |
| Actions | 104px | edit/delete; hidden or disabled when read-only |

Minimum table width:

- `min-w-[1820px]` is acceptable.
- The table must be inside a local `min-w-0 overflow-x-auto` surface.
- Page-level horizontal scroll is not acceptable.

Row density:

- table text: `text-sm`
- header text: existing `TableHead` style
- numeric cells: `tabular-nums`
- row height target: 56-64px

Sorting/filtering:

- Phase 7 must support stable default sorting by member name.
- Optional sorting affordances may be provided for grade, planned M/M, actual M/M, and delta.
- If sorting controls are present, use text buttons or icon+text headers with `aria-sort`.
- Filtering, if present, is limited to grade and member; do not add WBS filters in Phase 7.

### Monthly Matrix Layout

The matrix emphasizes comparison, not editing.

Structure:

- fixed left identity column: 240px
- month columns: 132px each
- each month cell shows planned and actual values in a two-line stack
- optional delta line appears only if it remains readable without expanding row height beyond 72px

Month range:

- Preferred: backend response months array.
- If frontend must derive display range, use the min/max month covered by staffing rows.
- Empty project: do not render an empty month grid; show empty state.

Horizontal overflow:

- Wrap the matrix in a local `overflow-x-auto` surface.
- The identity column should remain sticky on desktop and tablet.
- On mobile, sticky identity is still preferred, but not at the cost of overlap; if sticky is disabled, the member name must repeat in the first visible cell group or remain visible above the row.

Responsive behavior:

- Do not transform the matrix into cards in Phase 7.
- Preserve table semantics and horizontal scroll.
- The scroll container must have a visible focus outline and keyboard scroll support.

## Resource Dialog Contract

### Field Inventory

Create dialog fields:

1. Member
2. Grade
3. Monthly rate
4. Planned start date
5. Planned end date
6. Planned participation rate
7. Actual start date
8. Actual end date
9. Actual participation rate

Edit dialog fields:

- Same as create.
- Member may be read-only with helper text: "Member cannot be changed after the staffing row is created." if API keeps `(project, user)` unique semantics strict.

### Field Rules

Member:

- source: `fetchMembers(teamId)`
- cache key: `queryKeys.teams.members(teamId)`
- create mode requires a team member
- already-staffed members are disabled or omitted with helper copy
- the API remains the final authority for duplicate validation

Grade:

- enum values: `JUNIOR`, `MIDDLE`, `SENIOR`, `EXPERT`
- labels:
  - `JUNIOR`: `초급` / `Junior`
  - `MIDDLE`: `중급` / `Middle`
  - `SENIOR`: `고급` / `Senior`
  - `EXPERT`: `특급` / `Expert`

Monthly rate:

- integer KRW input
- `inputMode="numeric"`
- allow `0` only if backend policy permits; negative values are always invalid
- display helper: Korean won monthly rate used for M/M cost calculation

Planned fields:

- start and end date are required as a pair
- participation rate is required, 0-100 inclusive
- end date must be on or after start date

Actual fields:

- may be blank before work starts
- if one actual date is present, both actual dates are required
- actual participation rate is required when actual period is present
- actual M/M/cost remains blank or `-` until enough actual data exists

### Dialog Validation States

Validation must surface as text, toast, or inline helper copy. Placeholder-only validation is not acceptable.

Required validation copy:

- duplicate member
- selected user is not a team member
- invalid monthly rate
- planned date pair missing
- planned date order invalid
- planned participation out of range
- actual date pair missing
- actual date order invalid
- actual participation out of range

Submission:

- primary button: create mode `Add staffing row`; edit mode `Save staffing row`
- secondary button: `Close staffing dialog`
- loading copy: `Saving staffing row`
- successful create/update closes the dialog
- failed create/update keeps entered values intact

## States Contract

### Loading

- Initial tab load shows existing `Spinner` with staffing-specific text if available.
- Summary/table/matrix must not flash misleading zero totals before data loads.
- Refresh can use subtle loading state on the refresh button without replacing all visible data.

### Empty

Empty editable state:

- title: "Plan project staffing"
- body: "Add team members with periods, participation rates, grades, and monthly rates to calculate M/M and labor cost."
- CTA: "Add staffing row"

Empty read-only state:

- title: "No staffing rows yet"
- body: "Staffing rows have not been registered for this project."
- no primary CTA

### Error

Error state:

- title: "Staffing data could not be loaded"
- body: "Retry loading staffing rows and calculated M/M totals."
- action: "Retry staffing load"

Mutation errors:

- use `getErrorMessage(err, fallback)`
- fallback copy names the failed action: create, update, delete, refresh

### Read-Only

Read-only users:

- can view summary, table, and matrix
- cannot create, edit, or delete rows
- see a short hint near the toolbar: "You can review staffing data, but editing requires project edit access."
- action column may be hidden; if shown, disabled controls need accessible labels explaining read-only state

### Delete

Delete behavior:

- use existing `ConfirmDialog`
- confirmation title names the member
- description states that planned/actual M/M and cost for the row will be removed from project staffing totals
- CTA: `Delete staffing row`
- destructive color is reserved for the delete confirmation action only

## Copywriting Contract

All implementation copy must go through i18n. Do not hard-code visible Korean or English strings in React components.

### Required Translation Keys

| Key | Korean Copy | English Copy |
|-----|-------------|--------------|
| `staffing.tab.title` | 인력 투입 | Staffing |
| `staffing.section.title` | 인력 투입 계획 | Staffing plan |
| `staffing.section.description` | 팀원별 투입 기간, 참여율, 등급, 단가를 관리하고 계획 대비 실적 M/M을 비교합니다. | Manage team member periods, participation rates, grades, and rates, then compare planned and actual M/M. |
| `workspace.projectHub.staffingMeta` | 계획/실적 M/M 및 인건비 | Planned/actual M/M and labor cost |
| `staffing.action.create` | 인력 투입 추가 | Add staffing row |
| `staffing.action.refresh` | 인력 투입 새로고침 | Refresh staffing |
| `staffing.action.edit` | 인력 투입 수정 | Edit staffing row |
| `staffing.action.delete` | 인력 투입 삭제 | Delete staffing row |
| `staffing.summary.plannedMm` | 계획 M/M | Planned M/M |
| `staffing.summary.actualMm` | 실적 M/M | Actual M/M |
| `staffing.summary.deltaMm` | 차이 | Delta |
| `staffing.summary.plannedCost` | 계획 인건비 | Planned labor cost |
| `staffing.summary.actualCost` | 실적 인건비 | Actual labor cost |
| `staffing.field.member` | 팀원 | Member |
| `staffing.field.grade` | 등급 | Grade |
| `staffing.field.monthlyRate` | 월 단가 | Monthly rate |
| `staffing.field.plannedPeriod` | 계획 기간 | Planned period |
| `staffing.field.plannedParticipation` | 계획 참여율 | Planned participation |
| `staffing.field.actualPeriod` | 실적 기간 | Actual period |
| `staffing.field.actualParticipation` | 실적 참여율 | Actual participation |
| `staffing.field.plannedMm` | 계획 M/M | Planned M/M |
| `staffing.field.actualMm` | 실적 M/M | Actual M/M |
| `staffing.field.deltaMm` | M/M 차이 | M/M delta |
| `staffing.field.cost` | 인건비 | Labor cost |
| `staffing.field.actions` | 작업 | Actions |
| `staffing.form.createTitle` | 인력 투입 추가 | Add staffing row |
| `staffing.form.editTitle` | 인력 투입 수정 | Edit staffing row |
| `staffing.form.memberPlaceholder` | 팀원을 선택하세요 | Select a team member |
| `staffing.form.gradePlaceholder` | 등급을 선택하세요 | Select a grade |
| `staffing.form.ratePlaceholder` | 월 단가를 입력하세요 | Enter monthly rate |
| `staffing.form.memberLocked` | 생성 후 팀원은 변경할 수 없습니다. | Member cannot be changed after creation. |
| `staffing.empty.title` | 인력 투입을 계획하세요 | Plan project staffing |
| `staffing.empty.description` | 팀원의 기간, 참여율, 등급, 단가를 입력하면 M/M과 인건비가 자동 계산됩니다. | Add member periods, participation rates, grades, and rates to calculate M/M and labor cost. |
| `staffing.empty.readOnlyDescription` | 이 프로젝트에는 아직 인력 투입 행이 없습니다. | No staffing rows have been registered for this project. |
| `staffing.status.loadFailedTitle` | 인력 투입 정보를 불러오지 못했습니다 | Staffing data could not be loaded |
| `staffing.status.loadFailed` | 인력 투입 행과 계산된 M/M 합계를 다시 불러오세요. | Retry loading staffing rows and calculated M/M totals. |
| `staffing.status.readOnly` | 인력 투입 정보는 볼 수 있지만 수정하려면 프로젝트 편집 권한이 필요합니다. | You can review staffing data, but editing requires project edit access. |
| `staffing.toast.created` | 인력 투입 행을 추가했습니다 | Staffing row added |
| `staffing.toast.updated` | 인력 투입 행을 수정했습니다 | Staffing row updated |
| `staffing.toast.deleted` | 인력 투입 행을 삭제했습니다 | Staffing row deleted |
| `staffing.toast.createFailed` | 인력 투입 행을 추가하지 못했습니다 | Could not add staffing row |
| `staffing.toast.updateFailed` | 인력 투입 행을 수정하지 못했습니다 | Could not update staffing row |
| `staffing.toast.deleteFailed` | 인력 투입 행을 삭제하지 못했습니다 | Could not delete staffing row |
| `staffing.delete.title` | 인력 투입 행을 삭제할까요? | Delete staffing row? |
| `staffing.delete.description` | {{name}}의 계획/실적 M/M과 인건비가 프로젝트 합계에서 제거됩니다. | Planned/actual M/M and labor cost for {{name}} will be removed from project totals. |
| `staffing.delete.confirm` | 인력 투입 삭제 | Delete staffing row |
| `staffing.grade.junior` | 초급 | Junior |
| `staffing.grade.middle` | 중급 | Middle |
| `staffing.grade.senior` | 고급 | Senior |
| `staffing.grade.expert` | 특급 | Expert |
| `staffing.matrix.title` | 월별 투입 매트릭스 | Monthly staffing matrix |
| `staffing.matrix.description` | 월별 계획/실적 M/M을 팀원 단위로 비교합니다. | Compare monthly planned and actual M/M by member. |
| `staffing.matrix.planned` | 계획 | Planned |
| `staffing.matrix.actual` | 실적 | Actual |
| `staffing.matrix.empty` | 표시할 월별 투입 데이터가 없습니다. | No monthly staffing data to display. |

Copy tone:

- Korean copy should be direct and operational, using polite declarative phrasing where complete sentences are needed.
- English copy should use short product UI language, not legal/accounting language.
- Do not use generic CTA labels such as `Submit`, `OK`, or bare `Save`.

## Visual Contract

### Hierarchy

Primary hierarchy:

1. Summary strip
2. Resource table
3. Monthly matrix
4. Supporting read-only or calculation helper text

Do not create a large dashboard hero inside the staffing tab. The project hub already provides page-level context.

### Icon Use

Allowed icons:

- `UsersRound` or `UserRoundCog` for the tab and empty state
- `Plus` for create
- `RefreshCcw` for refresh
- `Pencil` for edit
- `Trash2` for delete
- `TrendingUp`, `TrendingDown`, or `Minus` only for delta indicators if they stay text-backed

Icon-only buttons need `aria-label` and tooltip text.

### Color

Use semantic tokens only.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `hsl(var(--background))`, `hsl(var(--card))` | page background and main operational surfaces |
| Secondary (30%) | `hsl(var(--secondary))`, `hsl(var(--surface-muted))` | table headers, subtle metric panels, disabled/read-only surfaces |
| Accent (10%) | `hsl(var(--primary))` | primary create CTA, active tab, focus rings, selected/focused row |
| Supporting semantic | `hsl(var(--brand-secondary))` | non-critical cost/M/M labels and positive informational emphasis |
| Destructive | `hsl(var(--destructive))` | delete confirmation only |

Accent reserved for:

- primary create CTA
- active tab state
- focus rings
- selected/focused row outline
- loading/progress indicator if needed

Accent is not reserved for all interactive elements.

Variance color:

- Positive/negative delta must include signed text.
- Use semantic color only as a secondary cue.
- Do not rely on red/green alone because over/under staffing can be context-dependent.

### Typography

Declared type scale for Phase 7 implementation:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / table header | 12px | 600 | 1.2 |
| Body / table cell | 14px | 400 | 1.45 |
| Section heading | 20px | 600 | 1.25 |
| Metric value | 28px | 600 | 1.15 |

Rules:

- Use `Pretendard`/sans for all staffing UI.
- Do not use `Noto Serif KR` display type inside the staffing tab.
- Use `font-variant-numeric: tabular-nums` or Tailwind `tabular-nums` for M/M, rates, and costs.
- No negative letter spacing in compact table, dialog, or metric panels.

### Spacing

Declared spacing scale:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon gaps, helper gaps |
| sm | 8px | compact controls, table cell internal groups |
| md | 16px | default field gaps, table cell padding |
| lg | 24px | section gaps, dialog block gaps |
| xl | 32px | major tab block gaps |
| 2xl | 48px | large empty-state vertical spacing |
| 3xl | 64px | page-level rare spacing only |

Exceptions: none.

## Data Refresh and Mutation Feedback

Query behavior:

- Use `queryKeys.staffing.all(teamId, projectId)` or equivalent nested key.
- Staffing mutations invalidate staffing data and any related project overview/progress queries through the existing project invalidation helper if applicable.
- Keep stale data visible during background refresh when possible.

Feedback:

- create/update/delete success uses toast copy from the staffing namespace.
- background refresh should not clear the table unless the initial load failed.
- delete confirmation closes only after mutation success.
- mutation failures keep user input and visible data stable.

Optimistic UI:

- Not required for Phase 7.
- If used, it must never show calculated M/M/cost values that the backend has not returned.

## Accessibility Contract

General:

- All form controls use `Label htmlFor`.
- Dialog title and description must describe create/edit intent.
- First focus in dialog lands on member select in create mode and grade or monthly-rate field in edit mode if member is locked.
- `Escape` closes dialogs unless a mutation is pending.
- Delete confirmation uses destructive button semantics and returns focus to the triggering row action after close.

Tables:

- Resource table and matrix keep semantic `<table>` structure.
- Sortable headers use `aria-sort` when sorting is implemented.
- Sticky columns must not trap focus or obscure focused cells.
- Horizontal scroll containers must be keyboard focusable when content overflows.

Screen reader text:

- Delta values announce signed M/M text.
- Empty actual values announce "Actual not entered" instead of only `-`.
- Icon-only row actions include member names in `aria-label`, for example `Edit staffing row for Kim Minjun`.

Color and contrast:

- Read-only, empty, and validation states are conveyed with text, not color alone.
- Destructive state uses existing destructive token and confirmation text.

## WBS Boundary Contract

Phase 7 must preserve the following language and UI boundaries:

- WBS assignee is task ownership/reference context.
- Staffing row is the source of truth for project M/M and labor cost.
- WBS `estimatedMm` remains work estimate, not staffing actuals or payroll cost input.
- Do not create staffing rows automatically from WBS assignees.
- Do not update WBS assignees when staffing rows change.
- Do not show WBS assignee counts as staffing totals.

Permitted reference treatment:

- Later plans may show a small read-only note such as "WBS assignee data is separate from staffing totals."
- Phase 7 does not require a WBS-assignee comparison panel.

## Implementation Targets

| File | Responsibility |
|------|----------------|
| `client/src/pages/diagram/DiagramsPage.tsx` | add staffing tab, hero branching, and max-width behavior |
| `client/src/components/staffing/StaffingTab.tsx` | top-level staffing query/state orchestration |
| `client/src/components/staffing/StaffingSummaryStrip.tsx` | planned/actual/delta/cost metric strip |
| `client/src/components/staffing/StaffingResourceTable.tsx` | canonical staffing rows and actions |
| `client/src/components/staffing/StaffingResourceDialog.tsx` | create/edit staffing row form |
| `client/src/components/staffing/StaffingMatrixTable.tsx` | monthly planned/actual matrix |
| `client/src/types/staffing.ts` | response and payload types |
| `client/src/api/staffingApi.ts` | staffing API functions with JSDoc |
| `client/src/constants/query-keys.ts` | staffing query key hierarchy |
| `client/src/i18n/locales/ko/translation.json` | Korean staffing copy |
| `client/src/i18n/locales/en/translation.json` | English staffing copy |

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| local primitives only | `Button`, `Dialog`, `Input`, `Label`, `Select`, `Table`, `ConfirmDialog`, `WorkspaceEmptyState`, `Spinner` | no third-party registry blocks |

No third-party registry blocks are allowed for Phase 7 without a separate safety review.

## Checker Verification

Manual equivalent of `gsd-ui-checker` completed on 2026-04-22.

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| 1 Copywriting | PASS | CTA, empty, error, mutation, delete, and read-only copy are action-specific in Korean and English. |
| 2 Visuals | PASS | Summary strip, resource table, and matrix hierarchy is explicit, with staffing placed in the project hub. |
| 3 Color | PASS | 60/30/10 roles and accent reservations are declared; destructive color is limited to delete confirmation. |
| 4 Typography | PASS | Four sizes and two weights are declared, with line heights and tabular-number rules. |
| 5 Spacing | PASS | Standard 4/8/16/24/32/48/64 spacing scale is declared with no exceptions. |
| 6 Registry Safety | PASS | No third-party registry blocks; local primitives only. |

Status: APPROVED. Planner can use this file as Phase 7 design context.

## Checker Sign-Off Criteria

This UI contract is complete for Phase 7 when all statements are true:

1. Staffing is placed as a project-hub tab with project-planning hero/context copy.
2. Summary strip exposes planned M/M, actual M/M, delta, planned labor cost, and actual labor cost.
3. Resource table has stable columns, local horizontal overflow, row actions, and read-only behavior.
4. Create/edit dialog validates member, grade, KRW monthly rate, plan fields, and actual fields.
5. Monthly matrix preserves member identity while allowing month columns to overflow horizontally.
6. Loading, empty, error, mutation, delete, and read-only states have staffing-specific copy.
7. Korean and English i18n keys are defined before implementation.
8. Accessibility expectations cover dialogs, tables, keyboard focus, labels, and screen-reader text.
9. Data feedback avoids showing unreturned calculated values.
10. WBS assignee reference and staffing source-of-truth boundaries are explicit.

## Source Attribution

- [RIS-170 plan](/RIS/issues/RIS-170#document-plan)
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/07-인력-투입/07-CONTEXT.md`
- `.planning/phases/07-인력-투입/07-DISCUSSION-LOG.md`
- `.planning/phases/06.1-wbs-작업공간-확장/06.1-UI-SPEC.md`
- `.planning/phases/06.1-wbs-작업공간-확장/SUMMARY.md`
- `DESIGN.md`
- `CLAUDE.md`
- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/components/wbs/WbsWorkspaceContent.tsx`
- `client/src/components/wbs/WbsItemFormDialog.tsx`
- `client/src/components/project/BusinessOverviewTab.tsx`
- `client/src/components/ui/table.tsx`
- `client/src/components/ui/tabs.tsx`
- `client/src/index.css`
