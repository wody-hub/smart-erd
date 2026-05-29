# Phase 6 Verification: 간트 차트

**Date:** 2026-04-16  
**Verifier:** smt-qa-analyzer-codex (RIS-119)  
**Head:** `05d5442`  
**Verdict:** PASS

## Scope

- Plan: `.planning/phases/06-간트-차트/06-01-PLAN.md`
- Context: `.planning/phases/06-간트-차트/06-CONTEXT.md`
- Research: `.planning/phases/06-간트-차트/06-RESEARCH.md`
- Summary: `.planning/phases/06-간트-차트/SUMMARY.md`
- Implementation:
  - `client/src/components/gantt/`
  - `client/src/pages/diagram/DiagramsPage.tsx`
  - `client/src/i18n/locales/en/translation.json`
  - `client/src/i18n/locales/ko/translation.json`
  - `client/test/unit/gantt-adapter.test.ts`
  - `client/test/unit/gantt-update-guards.test.ts`

## Prior Evidence Reviewed

- RIS-116 (`Phase 6-3: Gantt UI/UX review pass`): reviewed full comment thread, including earlier BLOCK findings (tree column collapse, delayed milestone style mismatch) and final PASS after follow-up fixes.
- RIS-117 (`Phase 6-4: Gantt verification and regression QA`): reviewed full comment thread, including the temporary regression defect and RIS-118 handoff that restored progress-edit blocking.
- This verifier pass did not rely on those verdicts alone; code paths and automated checks were re-validated independently on current `HEAD`.

## Final Verdict

Phase 6 delivers the stated goal: the project hub now exposes a dedicated `gantt` tab that visualizes existing WBS and milestone data, supports day/week/month zoom switching, persists finalized WBS date-range drag edits without adding backend APIs, and renders delayed milestones with distinct visual treatment.

No blocking gap was found against GANTT-01..04 or the Phase 6 plan. Remaining issues are non-blocking implementation risks, not phase blockers.

## Goal-Backward Verification

### GANTT-01: WBS 기반 간트 자동 렌더링

**PASS**

Evidence:
- `client/src/pages/diagram/DiagramsPage.tsx` adds the `gantt` tab and removes the `max-w-5xl` width cap when that tab is active.
- `client/src/components/gantt/GanttTab.tsx` fetches WBS and milestone data and passes the projected task list into `Gantt`.
- `client/src/components/gantt/gantt-adapter.ts` implements the required projection:
  - dated WBS -> `type: 'task'`
  - undated parent with dated descendants -> `type: 'summary'`
  - undated leaf with no dated descendants -> omitted from chart
  - milestone API rows -> `type: 'milestone'`
- `client/src/components/wbs/wbs-tree-utils.ts` is reused through `buildChildrenByParent()` and `flattenTreeItems()` so chart order follows existing WBS tree order rather than raw API order.

Why this satisfies the goal:
- The gantt is derived entirely from existing Phase 5 data contracts.
- No new backend endpoint or DB change is introduced.

### GANTT-02: 일/주/월 타임라인 조절

**PASS**

Evidence:
- `client/src/components/gantt/gantt-scale-presets.ts` defines the exact `day`, `week`, `month` presets with 2-row headers and matching `scales`, `cellWidth`, `lengthUnit`.
- `client/src/components/gantt/GanttTab.tsx` renders custom toolbar buttons from `GANTT_SCALE_PRESET_ORDER` and applies the chosen preset directly to `Gantt`.
- `GanttTab.tsx` also provides a `today` action using `scroll-chart`, with a range override fallback when direct scrolling is unavailable.

Why this satisfies the goal:
- Zoom is controlled from app-owned UI, not the SVAR default toolbar, which matches the plan and context constraints.

### GANTT-03: 간트 바 드래그로 기간 변경

**PASS**

Evidence:
- `client/src/components/gantt/GanttTab.tsx` allows drag only for editable WBS rows:
  - `drag-task` blocks summary and milestone dragging
  - vertical reorder attempts are blocked by rejecting `event.top`
- `update-task` handling persists only finalized edits:
  - ignores `event.inProgress`
  - rejects non-WBS tasks
  - resolves changes through `resolveWbsDateRangeUpdate()`
  - calls `updateWbsItem()` only when `startDate` or `endDate` actually changed
- `client/src/components/gantt/gantt-update-guards.ts` explicitly rejects progress-only or unchanged updates.
- `client/src/hooks/useProjectQueryInvalidation.ts` is called after successful save so WBS/milestone/overview views refresh consistently.

Why this satisfies the goal:
- Users can drag real WBS bars to change dates.
- The server write path is limited to finalized date changes, which matches the plan's persistence rule and avoids noisy mutations during drag.

### GANTT-04: 마일스톤 다이아몬드 + 지연 여부 구분

**PASS**

Evidence:
- `client/src/components/gantt/gantt-adapter.ts` maps milestones to built-in `type: 'milestone'` tasks and propagates `isDelayed`.
- `gantt-adapter.ts` also sets `critical: milestone.isDelayed`, giving the delayed state to SVAR's rendered task object.
- `client/src/components/gantt/GanttTab.tsx` applies milestone visual state by locating milestone bars and setting success/destructive colors.
- `client/src/components/gantt/gantt.css` defines on-track vs delayed milestone colors and legend hooks.
- Both locale files add milestone legend/status copy for the gantt tab.

Why this satisfies the goal:
- Milestones render as native SVAR milestone tasks and delayed milestones are visually differentiated.

## Plan Compliance Check

### Confirmed

- `@svar-ui/react-gantt` is installed and `@svar-ui/react-gantt/all.css` is imported from `GanttTab.tsx`.
- Theme wrapper selection follows app theme state via `Willow` / `WillowDark`.
- The shell enforces explicit minimum height and `.wx-theme { height: 100% }` is bridged in `gantt.css`.
- `text <- name` mapping is explicit for both WBS and milestone rows.
- Date-only parsing/formatting avoids `new Date('yyyy-MM-dd')` and uses local date construction.
- Range padding is applied from the full scheduled data extent.
- Out-of-scope actions are blocked at intercept level for add/delete/move/indent/link/editor/split flows.
- Grid/tree reorder is blocked separately from chart date dragging.

### Not found as blockers

- No evidence of backend expansion beyond existing WBS/milestone APIs.
- No evidence that summary or milestone rows can persist schedule changes.
- No evidence that progress-only edits trigger WBS date saves.

## Automated Evidence

Executed on current head (`05d5442`):

- `cd client && npm run build` -> PASS
- `cd client && npm run test:unit` -> FAIL (known runner path issue: Node cannot resolve directory target `.tmp-test/test/unit`)
- `cd client && node --test .tmp-test/test/unit/*.test.js` -> PASS (`308/308`)
- Date-only round-trip smoke (compiled helper):
  - `TZ=UTC` -> `2026-04-16`
  - `TZ=Asia/Seoul` -> `2026-04-16`
  - `TZ=America/Los_Angeles` -> `2026-04-16`

Relevant automated coverage:

- `client/test/unit/gantt-adapter.test.ts`
  - date-only helper round-trip
  - dated WBS / summary / milestone projection
  - omitted undated leaf behavior
  - WBS order preservation before milestone append
- `client/test/unit/gantt-update-guards.test.ts`
  - rejects non-date updates
  - rejects unchanged range updates
  - accepts changed finalized date ranges

## Remaining Risks

These are non-blocking for Phase 6 completion.

1. **Milestone delayed color styling depends on SVAR DOM internals.**
   - `GanttTab.tsx` uses `setID()` plus DOM querying and `MutationObserver` to apply delayed milestone colors.
   - This is valid on the pinned `@svar-ui/react-gantt` version in the repo, but a future library DOM change could break the styling hook without a TypeScript error.

2. **No component-level automated test exercises live SVAR drag behavior.**
   - Unit tests cover the adapter and guard logic well.
   - Actual pointer drag, `update-task` event flow, and toolbar interactions are still primarily protected by manual QA plus current-head build/test success.

3. **Existing Vite circular chunk warning remains in production build.**
   - Warning: `feature-dsl -> feature-code-sync -> feature-dsl`
   - This did not block the build and is not introduced by Phase 6 verification, but it remains technical debt outside the phase goal.

## Conclusion

**PASS**

Phase 6, as implemented on current head, satisfies the phase goal and GANTT-01..04. The remaining concerns are maintenance risks around SVAR DOM-coupled milestone styling and the lack of UI-level automation for drag flows, but neither prevents the shipped code from delivering the intended phase outcome now.
