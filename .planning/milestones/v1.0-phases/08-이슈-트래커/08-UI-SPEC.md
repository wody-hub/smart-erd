---
phase: 08
slug: 이슈-트래커
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-23
reviewed_at: 2026-04-23
source_issue: RIS-194
workflow_fallback: "Manual Codex equivalent of $gsd-ui-phase 8; local workflow is a Claude/GSD orchestration, not a standalone shell command in this runtime."
---

# Phase 08 - UI Design Contract: 이슈 트래커

> Visual and interaction contract for the project-hub `issues` tab. This is the frozen UI input for the Phase 8 planning and execution work.

---

## Design System

| Property | Value |
|----------|-------|
| App shell | Existing project hub in `client/src/pages/diagram/DiagramsPage.tsx` |
| Component library | Existing local shadcn/ui-style primitives only |
| Icon library | `lucide-react` |
| Data orchestration | React Query + local `queryKeys` + `useProjectQueryInvalidation()` extension |
| Surface type | Dense PM work surface aligned with WBS, Gantt, and Staffing tabs |
| Feedback | `sonner` toasts, `WorkspaceEmptyState`, inline read-only hints, local loading states |
| Export helper | Existing `downloadBlob()` helper and backend workbook download response |

No new visual language is introduced. The issues tab is an operational PM surface, not a dashboard or collaboration feed.

## Scope Freeze

This UI contract fixes the following boundaries:

1. Add an `issues` tab to the project hub after `staffing`.
2. The tab is the primary Phase 8 working surface; there is no dedicated route in v1.
3. The primary workflow is filter -> scan list -> create/edit -> quick status progress -> export.
4. Required issue fields are title, description, priority, status, and optional assignee.
5. Read-only users can view, filter, refresh, open detail dialogs, and export Excel.
6. Editable users can create issues, edit issue content, change assignee, and advance status.
7. Excel export must use the exact current filter state.
8. Desktop and mobile behavior are both explicitly defined in this contract.

Out of scope in this UI phase:

- delete action
- free-text search
- comments, attachments, mentions, notifications, watchers
- kanban board
- custom workflow or custom fields
- saved views, pagination, bulk edit, import
- WBS/staffing/document auto-linking

## Screen Inventory

### 1. Project Hub `issues` Tab

Purpose: first-class issue-tracker work surface inside the existing project hub.

- Add `issues` to the tab rail in `DiagramsPage`.
- Position it after `staffing`.
- Extend the wide-container rule so `issues` also uses `max-w-none`.
- Tab icon should be issue-specific, such as `CircleAlert`, and must not reuse the overview icon.
- Hero/meta copy must shift from staffing/business overview language to issue-management language.

### 2. Issues Toolbar + Filter Bar

Purpose: expose the canonical controls for filtering, refresh, export, and creation.

- Location: top of `IssuesTab`, below the hero and above the list surface.
- Visual shape: one operational block, not separate decorative cards.
- Controls must wrap cleanly without causing page-level horizontal scroll.
- Filter state is part of the screen contract, not a hidden overflow menu.

### 3. Issues List Surface

Purpose: canonical browse and status-management surface.

- Desktop/tablet uses a dense table.
- Mobile uses stacked issue cards derived from the same source data.
- Empty, loading, filtered-empty, and error states are part of the same surface.
- Quick status progress is available directly from the row/card for editable users.

### 4. Issue Dialog

Purpose: single detail surface for create, edit, and read-only inspection.

- One dialog component supports three modes:
  - create
  - edit
  - view-only
- Dialog is the only Phase 8 content editing surface.
- No separate full-page issue detail route is introduced in v1.

## Information Architecture

### Project Hub Navigation

Project hub tab order:

1. Documents
2. Business overview
3. WBS
4. Gantt
5. Staffing
6. Issues

Tab behavior:

- Switching to `issues` closes document-creation UI the same way other non-document tabs do.
- `issues` remains local tab state in `DiagramsPage`; no route split in v1.
- The tab must be directly reachable through the same tab mechanism as existing PM tabs.

### Hero Contract

For active issues mode:

- `workspaceContext.section`: `projects`
- `tone`: `projects`
- eyebrow: `issues.tab.title`
- description: `issues.section.description`
- meta: `workspace.projectHub.issuesMeta`

Recommended meta copy:

- Korean: `상태·우선순위·담당자 기준으로 이슈를 관리하고 현재 목록을 Excel로 내보냅니다.`
- English: `Manage project issues by status, priority, and assignee, then export the current list to Excel.`

### Primary Flow Hierarchy

Primary hierarchy:

1. Toolbar and filter bar
2. Issues list surface
3. Dialog for create/edit/view

Secondary hierarchy:

- read-only hint
- result count
- last refreshed/loading indicators

No summary dashboard is required in v1. The product requirement is list-and-filter first.

## Layout Contract

### Overall Shape

`IssuesTab` structure:

1. compact section header and action group
2. filter bar
3. list surface

Use `space-y-6` between major blocks.

Do not place the entire issue tracker inside nested decorative cards. One bordered operational surface per block is acceptable.

### Header and Action Group

Left:

- title: `issues.section.title`
- description: `issues.section.description`
- optional read-only hint when `canEdit === false`

Right:

- secondary action: `Refresh issues`
- secondary action: `Export Excel`
- primary CTA: `Create issue` (editable users only)

Rules:

- Refresh is always visible.
- Export is always visible, including read-only mode.
- Create is hidden for read-only users.
- While exporting, only the export button shows a pending state; the list remains usable.
- Button wrapping on smaller widths is required.

### Filter Bar

Controls:

1. Status segmented filter
2. Priority select
3. Assignee select
4. Reset filters action when non-default state exists
5. Result count text

Status filter:

- single-select segmented control
- values:
  - `ALL`
  - `REGISTERED`
  - `IN_PROGRESS`
  - `DONE`
- default: `ALL`
- reason: fast triage without introducing complex multi-select semantics in v1

Priority filter:

- single select with `All priorities` default
- values:
  - `LOW`
  - `MEDIUM`
  - `HIGH`
  - `CRITICAL`

Assignee filter:

- single select with:
  - `All assignees`
  - `Unassigned`
  - current team members

Layout:

- desktop: filters align in one wrapping row with actions on the right
- tablet: priority and assignee can wrap below the status control
- mobile: controls stack vertically and remain fully visible without horizontal scroll

Out of scope:

- search box
- advanced filter drawer
- date filter

## List Contract

### Desktop / Tablet Table

The issues table is the canonical browsing surface on `md` and above.

Columns:

| Column | Width | Contract |
|--------|-------|----------|
| Status | 120px | semantic badge with fixed enum order |
| Priority | 120px | semantic badge with restrained color |
| Issue | 420px min | title primary, description excerpt secondary |
| Assignee | 180px | member name or unassigned label |
| Updated | 160px | localized compact datetime/date |
| Actions | 180px | open/edit plus quick status action |

Table rules:

- Use local `overflow-x-auto`; never cause page-level horizontal scroll.
- `Issue` column carries the density burden; do not split title and description into separate columns.
- Description excerpt is optional when blank and clamps to two lines.
- Numeric issue IDs are not a primary column in v1.
- Use `text-sm` row density aligned with Staffing and WBS patterns.

Sorting:

- Backend owns default sorting.
- UI does not introduce local column sorting in v1.
- Recommended backend order remains unfinished first, higher priority first, then latest update.

### Row Actions

Editable row actions:

1. `Open` or row click -> edit dialog
2. Quick progress button

Quick progress button contract:

- `REGISTERED` -> `Start`
- `IN_PROGRESS` -> `Mark done`
- `DONE` -> no primary progress action; show subdued `Done` badge/text instead

The quick action is forward-only in the list.

Read-only row behavior:

- row click opens view-only dialog
- no inline status buttons
- no edit icon button

### Mobile Card List

Mobile switches from table to stacked cards.

Card anatomy:

1. title row
2. badge row with status and priority
3. assignee line
4. updated-at line
5. description excerpt
6. action row

Card behavior:

- editable users get `Open` and quick progress actions
- read-only users get `View` only
- action row may wrap to two lines on narrow devices
- cards keep the same filter state and sorting as desktop

Reason for card mode:

- issue data is interaction-heavy and easier to scan on phones as stacked cards than as a six-column horizontal table

## Issue Dialog Contract

### Modes

Create mode:

- for editable users only
- opens from `Create issue`
- initial status is `REGISTERED`

Edit mode:

- opens from list row/card
- editable users can modify title, description, priority, assignee, and status

View-only mode:

- used for read-only users
- may also be used by editable users if opened from a non-edit affordance later
- fields are rendered as read-only values or disabled inputs

### Field Inventory

Create fields:

1. Title
2. Description
3. Priority
4. Assignee

Edit/view fields:

1. Title
2. Description
3. Priority
4. Assignee
5. Status
6. Created at
7. Updated at

### Field Rules

Title:

- single-line text input
- required
- backend-enforced max length must surface through validation copy
- autofocus on create

Description:

- multiline textarea
- optional
- preserve line breaks
- empty description is valid

Priority:

- select control
- default create value: `MEDIUM`

Assignee:

- source: current team members from the team-members API/query
- include explicit `Unassigned` option
- show existing assignee even if the user later left the team, but do not allow selecting non-team members for new assignments

Status:

- hidden in create mode because create always starts at `REGISTERED`
- select in edit mode
- read-only badge/value in view-only mode

Metadata:

- created/updated timestamps are read-only support fields in edit/view mode
- metadata sits in a muted footer or side block, not in the primary form grid

### Validation and Submission

Required validation coverage:

- title required
- title length invalid
- assignee is not an active team member
- priority missing/invalid
- status missing/invalid in edit mode

Submission:

- create primary button: `Create issue`
- edit primary button: `Save issue`
- secondary button: `Close`
- pending copy:
  - create: `Creating issue`
  - edit: `Saving issue`
- successful create/update closes the dialog
- failed mutations keep entered values intact

## Status Presentation Contract

Status values:

- `REGISTERED`
- `IN_PROGRESS`
- `DONE`

Badge style:

- `REGISTERED`: neutral/emphasis outline
- `IN_PROGRESS`: primary or brand-accented outline/fill
- `DONE`: subdued success-style treatment

Priority values:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

Priority style:

- `LOW`: neutral
- `MEDIUM`: soft accent-neutral
- `HIGH`: warm emphasis
- `CRITICAL`: strongest semantic emphasis

Rules:

- priority color must not overpower status color
- both status and priority require text labels; color alone is never sufficient
- badges must stay compact and table-safe

## Export Contract

Export entry point:

- toolbar button in the top-right action cluster

Behavior:

- always exports the currently filtered list
- uses the same query parameters as the list request
- remains available in read-only mode
- shows spinner/pending text while the workbook is downloading
- duplicate clicks are disabled while pending

Copy:

- desktop label: `Export Excel`
- mobile label may stay text-based; do not collapse to icon-only in v1

If the filtered result is empty:

- export may remain enabled if backend supports empty workbook
- if backend rejects empty export, disable the button and explain why with inline helper or tooltip copy

## States Contract

### Loading

- initial load uses a centered spinner or skeleton state within the issues surface
- do not flash an empty state before the first query resolves
- refresh keeps existing rows visible and uses button-level pending feedback

### Empty

Editable empty state:

- title: `프로젝트 이슈를 등록하세요`
- body: `이슈를 추가해 상태, 우선순위, 담당자를 기준으로 프로젝트 실행 이슈를 관리하세요.`
- CTA: `Create issue`

Read-only empty state:

- title: `등록된 이슈가 없습니다`
- body: `이 프로젝트에는 아직 이슈가 등록되지 않았습니다.`
- no create CTA

### Filtered Empty

When filters return zero rows:

- keep the filter bar visible
- show dedicated filtered-empty copy instead of the global empty state
- provide `Reset filters`

### Error

Error state:

- title: `이슈 목록을 불러오지 못했습니다`
- body: `프로젝트 이슈와 현재 필터 결과를 다시 불러오세요.`
- action: `Retry`

Mutation errors:

- use `getErrorMessage()` pattern
- fallback copy names the failed action: create, update, status change, export, refresh

### Read-Only

Read-only users:

- can load the tab, filter results, refresh, open detail dialogs, and export
- cannot see create CTA
- cannot edit fields
- cannot use quick status actions
- must see a short hint near the header: `조회와 내보내기는 가능하지만 수정하려면 프로젝트 편집 권한이 필요합니다.`

## Responsive Contract

### Desktop

- toolbar and filter bar may share the same horizontal band when space allows
- table is the primary list surface
- actions remain right-aligned

### Tablet

- filters wrap before action buttons overflow
- table remains canonical
- actions can stack into two rows

### Mobile

- list becomes cards
- filter controls stack vertically
- export remains visible near the top; do not hide it behind a kebab menu
- create CTA remains visible for editable users
- page-level horizontal scroll is forbidden

## Data and Query Contract

Recommended query-key additions:

- `queryKeys.issues.list(teamId, projectId, filters)`

Recommended invalidation extension:

- add `includeIssues` to `useProjectQueryInvalidation()`
- invalidate issue list after create, update, status change, and export-affecting mutations

Dialog/member data:

- reuse the team member query pattern already used by Staffing
- do not fetch a second assignee-specific dataset in v1

## Copywriting Contract

All visible copy must go through i18n. Do not hard-code Korean or English strings in the React components.

### Required Translation Keys

| Key | Korean Copy | English Copy |
|-----|-------------|--------------|
| `issues.tab.title` | 이슈 | Issues |
| `issues.section.title` | 프로젝트 이슈 | Project issues |
| `issues.section.description` | 상태, 우선순위, 담당자를 기준으로 프로젝트 실행 이슈를 관리합니다. | Manage project execution issues by status, priority, and assignee. |
| `workspace.projectHub.issuesMeta` | 현재 목록 기준 Excel 내보내기 지원 | Excel export for the current filtered list |
| `issues.action.refresh` | 이슈 새로고침 | Refresh issues |
| `issues.action.export` | Excel 내보내기 | Export Excel |
| `issues.action.create` | 이슈 등록 | Create issue |
| `issues.action.edit` | 이슈 수정 | Edit issue |
| `issues.action.view` | 이슈 보기 | View issue |
| `issues.action.resetFilters` | 필터 초기화 | Reset filters |
| `issues.action.start` | 처리 시작 | Start |
| `issues.action.markDone` | 완료 처리 | Mark done |
| `issues.filter.status` | 상태 | Status |
| `issues.filter.priority` | 우선순위 | Priority |
| `issues.filter.assignee` | 담당자 | Assignee |
| `issues.filter.allStatuses` | 전체 상태 | All statuses |
| `issues.filter.allPriorities` | 전체 우선순위 | All priorities |
| `issues.filter.allAssignees` | 전체 담당자 | All assignees |
| `issues.filter.unassigned` | 미배정 | Unassigned |
| `issues.list.column.status` | 상태 | Status |
| `issues.list.column.priority` | 우선순위 | Priority |
| `issues.list.column.issue` | 이슈 | Issue |
| `issues.list.column.assignee` | 담당자 | Assignee |
| `issues.list.column.updatedAt` | 수정일 | Updated |
| `issues.list.column.actions` | 작업 | Actions |
| `issues.form.createTitle` | 이슈 등록 | Create issue |
| `issues.form.editTitle` | 이슈 수정 | Edit issue |
| `issues.form.viewTitle` | 이슈 상세 | Issue details |
| `issues.form.title` | 제목 | Title |
| `issues.form.description` | 내용 | Description |
| `issues.form.priority` | 우선순위 | Priority |
| `issues.form.assignee` | 담당자 | Assignee |
| `issues.form.status` | 상태 | Status |
| `issues.form.createdAt` | 생성일 | Created |
| `issues.form.updatedAt` | 수정일 | Updated |
| `issues.form.titlePlaceholder` | 이슈 제목을 입력하세요 | Enter an issue title |
| `issues.form.descriptionPlaceholder` | 처리 배경과 필요한 조치를 입력하세요 | Enter background and required action |
| `issues.empty.title` | 프로젝트 이슈를 등록하세요 | Create your first project issue |
| `issues.empty.description` | 이슈를 추가하면 상태, 우선순위, 담당자 기준으로 실행 이슈를 관리할 수 있습니다. | Add issues to manage execution work by status, priority, and assignee. |
| `issues.empty.readOnlyDescription` | 이 프로젝트에는 아직 등록된 이슈가 없습니다. | No issues have been registered for this project yet. |
| `issues.empty.filteredTitle` | 조건에 맞는 이슈가 없습니다 | No issues match these filters |
| `issues.empty.filteredDescription` | 필터를 조정하거나 초기화해 다른 이슈를 확인하세요. | Adjust or reset the filters to see other issues. |
| `issues.status.readOnly` | 조회와 내보내기는 가능하지만 수정하려면 프로젝트 편집 권한이 필요합니다. | You can review and export issues, but editing requires project edit access. |
| `issues.status.loadFailedTitle` | 이슈 목록을 불러오지 못했습니다 | Issues could not be loaded |
| `issues.status.loadFailed` | 프로젝트 이슈와 현재 필터 결과를 다시 불러오세요. | Retry loading project issues and the current filtered result. |
| `issues.toast.created` | 이슈를 등록했습니다 | Issue created |
| `issues.toast.updated` | 이슈를 수정했습니다 | Issue updated |
| `issues.toast.statusUpdated` | 이슈 상태를 변경했습니다 | Issue status updated |
| `issues.toast.exportFailed` | Excel 내보내기에 실패했습니다 | Excel export failed |
| `issues.toast.refreshFailed` | 이슈 새로고침에 실패했습니다 | Could not refresh issues |
| `issues.validation.titleRequired` | 제목을 입력하세요 | Enter a title |
| `issues.validation.titleTooLong` | 제목 길이를 확인하세요 | Check the title length |
| `issues.validation.assigneeInvalid` | 담당자는 현재 팀원만 선택할 수 있습니다 | Assignee must be a current team member |
| `issues.status.registered` | 등록 | Registered |
| `issues.status.inProgress` | 처리중 | In progress |
| `issues.status.done` | 완료 | Done |
| `issues.priority.low` | 낮음 | Low |
| `issues.priority.medium` | 보통 | Medium |
| `issues.priority.high` | 높음 | High |
| `issues.priority.critical` | 긴급 | Critical |

Copy tone:

- Korean copy should stay direct and operational.
- English copy should stay concise and product-oriented.
- Avoid generic labels such as `Submit`, `Save`, or `OK` without issue-specific context.

## Visual Contract

### Hierarchy

Primary hierarchy:

1. filterable work surface
2. current issue list
3. dialog for editing or viewing one issue

Do not insert decorative KPI cards ahead of the list. This phase is not a reporting dashboard.

### Icon Use

Allowed icon patterns:

- `CircleAlert` for tab or empty state
- `Plus` for create
- `RefreshCcw` for refresh
- `Download` for export
- `Pencil` for edit
- `Play` or `ArrowRight` for `Start`
- `Check` for `Mark done`

Icon-only buttons are not sufficient for primary actions in this phase.

### Color

Use semantic tokens only.

| Role | Value | Usage |
|------|-------|-------|
| Dominant | `hsl(var(--background))`, `hsl(var(--card))` | page and list surfaces |
| Secondary | `hsl(var(--secondary))`, `hsl(var(--surface-muted))` | filter bar background, table headers, muted metadata |
| Accent | `hsl(var(--primary))` | create CTA, active tab, focus rings, in-progress emphasis |
| Supporting semantic | existing status/priority semantic tokens | badges only |

Rules:

- priority should feel secondary to status
- avoid a rainbow of saturated badges
- badge contrast must remain accessible in both languages

### Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Filter label / table header | 12px | 600 | 1.2 |
| Body / list row | 14px | 400 | 1.45 |
| Section heading | 20px | 600 | 1.25 |
| Card title / dialog title | 16-20px | 600 | 1.25 |

Rules:

- use the existing application sans stack
- use `tabular-nums` for timestamps only if the local pattern already applies it
- description text must remain subordinate to titles

## Implementation Notes For Phase Planning

- Add `issues` hero copy handling to `DiagramsPage`.
- Extend the project-hub wide-layout branch to include `issues`.
- Keep API function docs/JSDoc aligned with existing `staffingApi` and `wbsApi` style.
- Reuse the team-members query for assignee options.
- Reuse the existing download helper rather than introducing a frontend spreadsheet library.

## Deferred Follow-Ups

- deletion flow
- pagination and saved filters
- search
- comments and attachments
- kanban mode
- cross-linking to WBS/staffing/documents
- reporting widgets and rollups

