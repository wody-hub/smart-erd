# Phase 07 - UI Review

**Audited:** 2026-04-22
**Reviewer:** smt-designer-sonnet
**Baseline:** `07-UI-SPEC.md` design contract
**Browser evidence:** Playwright Chromium mobile fixture with mocked Phase 7 staffing API data
**Initial Verdict:** FLAG
**Final Verdict:** PASS

---

## Final Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Staffing tab, toolbar, empty/error/read-only, mutation, delete, validation, and matrix copy all use `staffing.*` or project-hub i18n keys in EN/KO. |
| 2. Visuals | 4/4 | The project hub hierarchy is clear: staffing hero/meta context, then compact header, summary strip, resource table, and monthly matrix. |
| 3. Color | 4/4 | The initial destructive negative-delta color was removed; delta now relies on signed text and neutral color unless positive informational emphasis is used. |
| 4. Typography | 3/4 | Dense table/dialog typography and tabular numerals are correct; metric values are slightly smaller than the 28px contract but remain readable and consistent with adjacent project surfaces. |
| 5. Spacing | 4/4 | Resource table and matrix overflow are locally contained; mobile browser inspection showed no page-level horizontal overflow at 390px. |
| 6. Experience Design | 4/4 | Loading/error/empty/read-only/create/edit/delete/windowed-matrix states exist, and the matrix scroll region now has visible keyboard focus treatment. |

**Final Overall:** 23/24

---

## Initial Findings Resolved During Review

1. **Matrix scroll focus was invisible.**
   `StaffingMatrixTable` made the matrix scroll region focusable but used an outline-removal class, so keyboard users could land on the horizontal scroll region without a visible focus cue. This violated the matrix accessibility contract.

   Resolution: the scroll region now keeps local overflow, adds rounded focus geometry, and shows the standard ring on focus (`client/src/components/staffing/StaffingMatrixTable.tsx:118`).

2. **Negative delta used destructive color.**
   `StaffingSummaryStrip` mapped every negative delta to `text-destructive`, but the UI contract reserves destructive color for delete confirmation unless copy explicitly frames the delta as an overrun or shortage.

   Resolution: negative delta now uses neutral foreground while preserving signed numeric text (`client/src/components/staffing/StaffingSummaryStrip.tsx:28`).

3. **Icon-only row actions had no hover tooltip text.**
   Edit/delete buttons had accessible labels, but the contract also asks icon-only buttons to expose tooltip text.

   Resolution: edit/delete row actions now include matching `title` text alongside `aria-label` (`client/src/components/staffing/StaffingResourceTable.tsx:158`).

---

## Contract Coverage

### Project Hub and IA

- Staffing is a first-class project-hub tab after Gantt and uses `UsersRound` as the people-first marker (`client/src/pages/diagram/DiagramsPage.tsx:192`).
- Staffing hero context switches to `section: projects`, `tone: projects`, `staffing.tab.title`, `staffing.section.description`, and `workspace.projectHub.staffingMeta` with no document-count metadata (`client/src/pages/diagram/DiagramsPage.tsx:123`).
- Staffing and Gantt use `max-w-none`, matching the wide project-planning surfaces (`client/src/pages/diagram/DiagramsPage.tsx:236`).

### Summary, Table, and Matrix

- Summary strip exposes planned M/M, actual M/M, delta, planned labor cost, and actual labor cost with tabular numbers and `formatCurrency()` (`client/src/components/staffing/StaffingSummaryStrip.tsx:36`).
- Resource table uses stable member-name sorting, no inline editing, canonical create/edit/delete actions, and local `min-w-0 overflow-x-auto` containment around the `min-w-[1820px]` table (`client/src/components/staffing/StaffingResourceTable.tsx:63`, `client/src/components/staffing/StaffingResourceTable.tsx:73`).
- Monthly matrix is read-only, keeps sticky member identity, uses backend month data, and switches to 12-month window controls when more than 18 months are present (`client/src/components/staffing/StaffingMatrixTable.tsx:41`, `client/src/components/staffing/StaffingMatrixTable.tsx:53`, `client/src/components/staffing/StaffingMatrixTable.tsx:122`).

### Dialog and States

- Create/edit dialog uses local primitives, labels every field, locks the member in edit mode, focuses member create / monthly-rate edit targets, and preserves user input on failed mutation (`client/src/components/staffing/StaffingResourceDialog.tsx:120`, `client/src/components/staffing/StaffingResourceDialog.tsx:238`).
- Planned and actual validations include date-pair/order, participation range, monthly-rate range, and actual-input atomicity; the actual participation-only regression is covered by unit tests (`client/src/components/staffing/staffing-dialog-validation.ts:33`).
- Loading, load failure, editable empty, read-only empty, read-only toolbar hint, delete confirmation, and mutation toasts are staffing-specific (`client/src/components/staffing/StaffingTab.tsx:170`, `client/src/components/staffing/StaffingTab.tsx:178`, `client/src/components/staffing/StaffingTab.tsx:222`, `client/src/components/staffing/StaffingTab.tsx:260`).

### Boundary Safety

- The frontend staffing API uses the planned `/api/teams/{teamId}/projects/{projectId}/staffing` route hierarchy and displays backend-calculated values only (`client/src/api/staffingApi.ts:14`).
- No WBS auto-create, WBS sync, payroll, HR, accounting, timesheet, or grade/rate master UI was introduced in the audited frontend surface.
- Registry safety passes: no third-party blocks were added; the implementation uses existing local primitives and `lucide-react`.

---

## Browser Inspection

Mocked Playwright render:

- URL: `http://127.0.0.1:5173/teams/1/projects/10/diagrams`
- Viewport: `390x844`
- Fixture: two staffing resources, 24 backend months, negative summary delta, read/write role
- Result: no page-level horizontal overflow (`bodyScrollWidth=390`, `documentScrollWidth=390`, viewport `390`)
- Result after fix: negative summary delta computed color is neutral foreground (`rgb(14, 23, 38)`)
- Result after fix: matrix scroll target is focusable and renders the project ring box-shadow on focus

Screenshot generated during audit: `/tmp/phase7-staffing-mobile-fixed.png`

---

## Verification

- `cd client && npm run build` - passed on 2026-04-22. The existing Vite circular chunk warning (`feature-dsl -> feature-code-sync -> feature-dsl`) remains unchanged.
- `cd client && npm run test:unit` - passed on 2026-04-22 (`319` passing tests).
- Playwright Chromium mocked mobile inspection - passed on 2026-04-22.

---

## Files Audited

- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/components/staffing/StaffingTab.tsx`
- `client/src/components/staffing/StaffingSummaryStrip.tsx`
- `client/src/components/staffing/StaffingResourceTable.tsx`
- `client/src/components/staffing/StaffingResourceDialog.tsx`
- `client/src/components/staffing/StaffingMatrixTable.tsx`
- `client/src/components/staffing/staffing-dialog-validation.ts`
- `client/src/components/staffing/staffing-matrix-window.ts`
- `client/src/api/staffingApi.ts`
- `client/src/types/staffing.ts`
- `client/src/constants/query-keys.ts`
- `client/src/hooks/useProjectQueryInvalidation.ts`
- `client/src/i18n/locales/en/translation.json`
- `client/src/i18n/locales/ko/translation.json`
- `client/test/unit/staffing-dialog-validation.test.ts`
- `client/test/unit/staffing-matrix-window.test.ts`

---

## Outcome

No remaining UI blockers were found. Phase 7 UI review passes after the small contract fixes above.
