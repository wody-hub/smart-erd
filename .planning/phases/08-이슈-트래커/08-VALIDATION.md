---
phase: 8
slug: 이슈-트래커
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
source_issue: RIS-201
---

# Phase 08 - Validation Strategy

> Nyquist validation rerun for Phase 8 issue tracker closeout (`$gsd-validate-phase 8` fallback execution).

---

## Audit Scope

This rerun re-checks Phase 8 `ISSUE-01` to `ISSUE-04` against the current checkout with emphasis on:

- permission boundaries (read-only vs editable flows)
- forward-only status transition contract
- filter composition and list/export parity
- proof quality in backend/frontend automated evidence

---

## Evidence Snapshot

| Area | Evidence | Result |
| --- | --- | --- |
| Backend issue service/controller rerun | `./gradlew test --rerun-tasks --tests com.smarterd.domain.pm.issue.service.ProjectIssueServiceTest --tests com.smarterd.api.project.ProjectIssueControllerMvcTest` | PASS |
| Backend detailed test count | `build/test-results/test/TEST-com.smarterd.domain.pm.issue.service.ProjectIssueServiceTest.xml` (`7/7`), `build/test-results/test/TEST-com.smarterd.api.project.ProjectIssueControllerMvcTest.xml` (`7/7`) | PASS |
| Frontend unit regression suite | `cd client && npm run test:unit -- project-issues` | PASS (`326/326`) |
| Frontend build gate | `cd client && npm run build` | PASS |

---

## Requirement Coverage (ISSUE-01~04)

### ISSUE-01 - Create issue with title/description/priority/assignee

Status: **PASS**

- Backend create flow and default priority are validated in `ProjectIssueServiceTest#createProjectIssue_defaultsPriorityAndValidatesAssignee`.
- Controller create contract is validated in `ProjectIssueControllerMvcTest#createProjectIssue_returnsCreated`.
- Assignee membership constraint is covered by `ProjectIssueServiceTest#createProjectIssue_nonMember_throwsAccessDenied`.

### ISSUE-02 - Forward-only status flow (`REGISTERED -> IN_PROGRESS -> DONE`)

Status: **PASS**

- Service guard for invalid jumps is covered by `updateProjectIssueStatus_rejectsNonNextTransition` and `advanceProjectIssueStatus_doneIssue_throwsConflict`.
- Controller status endpoint behavior is covered by `updateProjectIssueStatus_returnsUpdatedIssue`.
- Frontend transition helper contract is covered by `client/test/unit/project-issues.test.ts`:
  - `getNextProjectIssueStatus advances in the approved v1 sequence only`
  - `getProjectIssueTransitionLabelKey returns null once an issue is already done`
  - `getProjectIssueEditableStatuses keeps edit mode forward-only`

### ISSUE-03 - Filter by status/priority/assignee (including unassigned)

Status: **PASS (automation + static UI proof)**

- Backend list filter binding is covered by `ProjectIssueControllerMvcTest#getProjectIssues_returnsFilteredList`.
- Frontend filter serialization is covered by `project-issues.test.ts`:
  - explicit status/priority/assignee mapping
  - unassigned sentinel to `unassignedOnly`
  - query param serialization
- Empty-list rendering for both no-filter and filtered states is present in `client/src/components/issues/IssuesTab.tsx` (`WorkspaceEmptyState` branches for `items.length === 0` + `hasActiveFilters`).

### ISSUE-04 - Export current filtered list to Excel

Status: **PASS**

- Export endpoint filter binding parity is validated in `ProjectIssueControllerMvcTest#downloadProjectIssuesExcel_returnsExcelAttachment` (same query shape as list).
- Workbook generation and safe string-cell writing are validated in `ProjectIssueServiceTest#exportProjectIssues_buildsWorkbookWithStringCells`.
- Frontend build and unit reruns keep export wiring path healthy (`issuesApi`, query serialization, download flow).

---

## Required Nyquist Rows Check

| Row | Verdict | Evidence |
| --- | --- | --- |
| Editable team member can create issue | PASS | Service/controller create tests |
| Viewer write operations are denied | PASS (status update explicit), PARTIAL (create/update path inferred by shared write-context gate) | `viewerUpdateStatus_returnsForbidden`, shared `ProjectContextLoader.load(..., true)` path |
| Assignee must be current team member | PASS | `createProjectIssue_nonMember_throwsAccessDenied` |
| Status transition follows required order | PASS | Service transition guard tests + frontend transition helper tests |
| Status/priority/assignee filters compose | PASS | Controller filter test + frontend filter serialization tests |
| Export uses the same active filters as list | PASS | Controller export query binding + service export test |
| Empty list + no-filter states render correctly | PASS (static code proof), PARTIAL (no dedicated UI automation) | `IssuesTab.tsx` empty-state branches |

---

## Confidence Gaps (Non-Blocking)

1. No dedicated browser automation in this rerun for issue tab UX paths (empty/no-filter transitions and read-only create/update denial on each button path).
2. Viewer write denial has explicit automated proof on status transition, while create/update denial is currently inferred through the shared write-context authorization path rather than separate endpoint-level negative tests.

Both are validation-depth gaps, not observed behavioral failures in the current rerun.

---

## Nyquist Verdict

**PASS (with documented non-blocking proof-depth gaps)**

Phase 8 validation rerun confirms `ISSUE-01` through `ISSUE-04` remain behaviorally covered on the current checkout, with backend and frontend checks green and no new blocker found.
