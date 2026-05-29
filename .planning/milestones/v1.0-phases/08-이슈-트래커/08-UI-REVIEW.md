# Phase 08 - UI Review

**Audited:** 2026-04-23
**Reviewer:** smt-pm-opus
**Baseline:** `08-UI-SPEC.md` design contract
**Browser evidence:** not captured; this rerun is based on the current integrated checkout plus frontend/backend verification
**Initial Verdict:** BLOCK
**Final Verdict:** PASS

---

## Final Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | The issue tab, filter, dialog, empty/error, read-only, and action copy are localized and aligned with the approved operational language. |
| 2. Visuals | 4/4 | The project hub now presents the `issues` surface with the approved icon, desktop table, and mobile card layout. |
| 3. Color | 4/4 | Status and priority badges stay within restrained semantic color use and preserve clear text labels. |
| 4. Typography | 4/4 | Table, filter, and dialog typography match the existing PM surfaces and maintain the intended density hierarchy. |
| 5. Spacing | 4/4 | The surface uses the approved block spacing, local table overflow containment, and mobile card layout without page-level horizontal scroll. |
| 6. Experience Design | 4/4 | Create, edit, view-only, quick progress, export, refresh, read-only inspection, and backend parity are all implemented in the current checkout. |

**Final Overall:** 24/24

---

## Resolved Blockers

1. **Frontend and backend contracts are now aligned.**

   The controller now returns `{ items, summary }`, accepts the singular frontend filter params, and exposes `PATCH /issues/{id}/status` while retaining backward-compatible parsing for the earlier plural params. The client API and backend service/controller are now wired to the same list, export, and status progression contract.

   Evidence:
   - `client/src/api/issuesApi.ts`
   - `client/src/lib/project-issues.ts`
   - `client/src/types/issues.ts`
   - `src/main/java/com/smarterd/api/project/ProjectIssueController.java`
   - `src/main/java/com/smarterd/api/project/dto/issue/ProjectIssueListResponse.java`
   - `src/main/java/com/smarterd/api/project/dto/issue/UpdateProjectIssueStatusRequest.java`
   - `src/main/java/com/smarterd/domain/pm/issue/service/ProjectIssueService.java`

2. **The frontend build gate is green again.**

   The issue tracker components, translation keys, and typed i18n surface now agree. The new view/mobile/detail paths compile cleanly, and the project issue helper tests were extended for the forward-only edit-mode status behavior.

   Evidence:
   - `client/src/components/issues/IssueDialog.tsx`
   - `client/src/components/issues/IssueCardList.tsx`
   - `client/src/components/issues/IssueFilterBar.tsx`
   - `client/src/components/issues/IssueTable.tsx`
   - `client/src/i18n/locales/en/translation.json`
   - `client/src/i18n/locales/ko/translation.json`
   - `client/test/unit/project-issues.test.ts`

3. **The read-only and mobile interaction contract is now implemented.**

   The issues surface now renders a dense desktop table and a separate mobile card list, and the single dialog supports create, edit, and view-only modes with status plus created/updated metadata. Read-only users can open issue details from both the table and card surfaces while keeping create/edit/progress actions hidden.

   Evidence:
   - `client/src/components/issues/IssuesTab.tsx`
   - `client/src/components/issues/IssueFilterBar.tsx`
   - `client/src/components/issues/IssueTable.tsx`
   - `client/src/components/issues/IssueCardList.tsx`
   - `client/src/components/issues/IssueDialog.tsx`

---

## Contract Coverage

### Project Hub

- `issues` is present after Staffing in the project hub tab order
- `CircleAlert` is used as the issue-specific tab icon
- The issues surface participates in the wide PM container rule
- The hero uses issue-management copy and the approved `workspace.projectHub.issuesMeta`

### Toolbar And Filters

- Refresh and Excel export remain visible in both editable and read-only modes
- Create is hidden in read-only mode
- Status is implemented as a segmented filter
- Priority and assignee filters wrap cleanly without introducing page-level overflow
- Reset filters and result count are part of the visible filter surface

### List And Dialog

- Desktop/tablet use the canonical dense table shape
- Mobile uses stacked issue cards with open/view and quick-progress actions
- Read-only users can open the single detail dialog from list surfaces
- Edit mode supports forward-only status changes
- Create/edit/view modes all live in the same dialog component
- Created/updated metadata is shown for non-create modes

---

## Verification

- `cd client && npm run build` - passed on 2026-04-23
- `cd client && npm run test:unit` - passed on 2026-04-23 (`326` tests)
- `./gradlew test --tests com.smarterd.api.project.ProjectIssueControllerMvcTest --tests com.smarterd.domain.pm.issue.service.ProjectIssueServiceTest` - passed on 2026-04-23
- Static code review of the current integrated checkout confirms the previously blocked contract gaps are closed
- Browser capture was not taken in this heartbeat

---

## Files Audited

- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/components/issues/IssuesTab.tsx`
- `client/src/components/issues/IssueFilterBar.tsx`
- `client/src/components/issues/IssueTable.tsx`
- `client/src/components/issues/IssueCardList.tsx`
- `client/src/components/issues/IssueDialog.tsx`
- `client/src/api/issuesApi.ts`
- `client/src/lib/project-issues.ts`
- `client/src/types/issues.ts`
- `client/src/i18n/locales/en/translation.json`
- `client/src/i18n/locales/ko/translation.json`
- `client/test/unit/project-issues.test.ts`
- `src/main/java/com/smarterd/api/project/ProjectIssueController.java`
- `src/main/java/com/smarterd/api/project/dto/issue/ProjectIssueListResponse.java`
- `src/main/java/com/smarterd/api/project/dto/issue/UpdateProjectIssueStatusRequest.java`
- `src/main/java/com/smarterd/domain/pm/issue/service/ProjectIssueService.java`
- `src/test/java/com/smarterd/api/project/ProjectIssueControllerMvcTest.java`
- `src/test/java/com/smarterd/domain/pm/issue/service/ProjectIssueServiceTest.java`

---

## Outcome

Phase 8 UI retro review now passes on the current checkout.

This issue can move forward, and [RIS-199](/RIS/issues/RIS-199) may continue validation/UAT without waiting on additional Phase 8 UI contract fixes.
