# Phase 6 UI Review: 간트 차트

**Date:** 2026-04-16  
**Reviewer:** smt-designer-sonnet  
**Head:** `05d5442`  
**Initial Verdict:** FLAG  
**Final Re-review Verdict:** PASS  
**Overall Score:** 17/24 (initial audit)  
**Screenshots:** captured (`desktop` Paper, `desktop` Graphite, `mobile` 390px overview, `mobile` 390px chart view)

## Scope

- Plan: `.planning/phases/06-간트-차트/06-01-PLAN.md`
- Context: `.planning/phases/06-간트-차트/06-CONTEXT.md`
- Verification: `.planning/phases/06-간트-차트/06-VERIFICATION.md`
- Implementation:
  - `client/src/pages/diagram/DiagramsPage.tsx`
  - `client/src/components/gantt/GanttTab.tsx`
  - `client/src/components/gantt/gantt.css`
  - `client/src/components/ui/tabs.tsx`
  - `client/src/i18n/locales/en/translation.json`
  - `client/src/i18n/locales/ko/translation.json`

## Pillar Summary

| Pillar | Score | Summary |
| --- | --- | --- |
| Copywriting | 2/4 | Core gantt strings are good, but the active tab still inherits document-hub framing and one recovery state still points to the document hub. |
| Visuals | 3/4 | Desktop hierarchy is clear and milestones read well, but the surrounding page chrome still looks like a document surface instead of a planning surface. |
| Color | 4/4 | Paper and Graphite both preserve native-looking contrast, and delayed/on-track milestones remain easy to distinguish. |
| Typography | 3/4 | The chart area uses a tight, consistent type scale, but the reused document hero headline dominates narrow screens before the tool appears. |
| Spacing | 2/4 | Desktop spacing is stable, but the tab rail and chart shell do not adapt cleanly at 390px width. |
| Experience Design | 3/4 | Editing affordances, empty state, and read-only hint are present, but mobile first-view discoverability and page-level context still need work. |

## Top 3 Fixes

1. Branch the project-hub hero and workspace chrome when `activeTab === 'gantt'` so the page stops reading like a document hub.
2. Add a small-screen treatment for the tab rail and gantt shell so the chart is visible on first render at 390px width.
3. Wire the gantt failure state to `gantt.status.loadFailed*` instead of `workspace.status.documentsLoadFailed`.

## Findings

### 1. Copywriting — 2/4

What passes:
- The gantt-specific body copy is direct and task-oriented: description, drag hint, empty state, read-only hint, and milestone legend all describe timeline work clearly (`client/src/components/gantt/GanttTab.tsx:425`, `client/src/components/gantt/GanttTab.tsx:479`, `client/src/i18n/locales/en/translation.json:629`, `client/src/i18n/locales/en/translation.json:640`, `client/src/i18n/locales/en/translation.json:665`, `client/src/i18n/locales/ko/translation.json:627`, `client/src/i18n/locales/ko/translation.json:638`, `client/src/i18n/locales/ko/translation.json:663`).

What fails:
- The active gantt tab still inherits document-hub framing. The top-level workspace section stays `documents`, the hero description stays document-specific, the tone stays `documents`, and the meta still advertises document count (`client/src/pages/diagram/DiagramsPage.tsx:161`, `client/src/pages/diagram/DiagramsPage.tsx:179`, `client/src/pages/diagram/DiagramsPage.tsx:181`, `client/src/pages/diagram/DiagramsPage.tsx:182`, `client/src/pages/diagram/DiagramsPage.tsx:186`).
- The gantt error state still renders `workspace.status.documentsLoadFailed`, even though gantt-specific recovery copy already exists under `gantt.status.loadFailed` (`client/src/components/gantt/GanttTab.tsx:373`, `client/src/i18n/locales/en/translation.json:665`, `client/src/i18n/locales/ko/translation.json:663`).

Why it matters:
- The page tells two different stories at once: the hero says "documents" while the working surface says "gantt".
- Error recovery copy that mentions the document hub weakens trust because it names the wrong surface.

### 2. Visuals — 3/4

What passes:
- The gantt shell establishes a strong focal point on desktop: toolbar first, timeline description second, chart third, stats and legend last (`client/src/components/gantt/GanttTab.tsx:403-481`).
- Milestones are visually distinct in both captured themes. The Paper and Graphite screenshots both show clear red/green diamonds, readable task bars, and enough contrast between grid, bars, and chart background (`client/src/components/gantt/gantt.css:9-49`, `client/src/components/gantt/gantt.css:61-75`).

What fails:
- The surrounding hero is still the dominant visual element on the gantt tab, and it is styled as a document surface rather than a project-planning surface (`client/src/pages/diagram/DiagramsPage.tsx:178-218`).
- On mobile, the first chart view is not self-explanatory: the grid consumes most of the visible shell and the timeline reads as clipped behind the internal splitter instead of immediately presenting "this is a timeline" at first glance. This was reproducible in the 390px screenshot capture.

Why it matters:
- The chart itself is strong, but the page-level hierarchy still spends too much visual energy on the wrong mode.
- On narrow screens, the user has to infer that more schedule content exists off to the side.

### 3. Color — 4/4

What passes:
- The token bridge keeps SVAR aligned with the app palette in both light and dark contexts (`client/src/components/gantt/gantt.css:9-33`).
- Delayed and on-track milestones remain distinct through both bar styling and legend markers (`client/src/components/gantt/gantt.css:35-49`, `client/src/components/gantt/gantt.css:61-75`, `client/src/components/gantt/GanttTab.tsx:466-475`).
- The Graphite capture showed the gantt shell, task bars, and milestone colors staying legible without reverting to hard-coded light-theme assumptions.

No blocking color issue found.

### 4. Typography — 3/4

What passes:
- Toolbar, chart columns, stats, legend, and footer hint use a restrained type scale and weight mix. The gantt surface mostly stays within `text-xs`, `text-sm`, `font-medium`, and `font-semibold`, which keeps the information density readable (`client/src/components/gantt/GanttTab.tsx:425`, `client/src/components/gantt/GanttTab.tsx:456-474`, `client/src/components/gantt/gantt.css:51-58`).

What fails:
- The reused project hero headline remains very large relative to the actual gantt tool, especially on mobile. With longer project names, the headline consumes most of the first viewport before the user reaches the timeline.

Why it matters:
- The chart typography is disciplined, but the page-level hierarchy still prioritizes the inherited document hero over the gantt work surface.

### 5. Spacing — 2/4

What passes:
- Desktop spacing is stable. The shell height contract, toolbar gaps, and stats grid all hold together without layout jitter (`client/src/components/gantt/GanttTab.tsx:404-481`).

What fails:
- The shared tab rail is `inline-flex` with no wrap or explicit horizontal scrolling treatment. In the 390px audit capture, the rendered tab row exceeded the viewport width and pushed right-side triggers out of the safe area (`client/src/components/ui/tabs.tsx:16-20`, `client/src/components/ui/tabs.tsx:35-38`).
- The gantt shell is fixed to `overflow-hidden` with a large minimum height, but it has no narrow-screen adaptation. On mobile, that leaves the first visible chart frame dominated by the grid slice while the schedule portion is mostly hidden (`client/src/components/gantt/GanttTab.tsx:427-432`).

Why it matters:
- The desktop contract is solid, but the current spacing model assumes enough horizontal room for both the hub tabs and the gantt grid/chart split.

### 6. Experience Design — 3/4

What passes:
- Loading, error, empty, retry, editable, and read-only states all exist in code; the gantt is not a happy-path-only surface (`client/src/components/gantt/GanttTab.tsx:361-399`, `client/src/components/gantt/GanttTab.tsx:442`, `client/src/components/gantt/GanttTab.tsx:479-480`).
- Toolbar affordances are simple and predictable: `Day`, `Week`, `Month`, `Today`.
- Milestone count, omitted-item count, and legend status help explain what the user is seeing (`client/src/components/gantt/GanttTab.tsx:454-477`).

What fails:
- The wrong page chrome and wrong error recovery copy make the gantt tab feel only partially integrated.
- Mobile first-view discoverability is weak because the chart does not clearly present the timeline without additional exploration.

Why it matters:
- The interaction model is good, but the surrounding experience still has integration seams.

## Priority Fix Detail

### Fix 1: Branch project-hub framing for gantt mode

Update the `DiagramsPage` hero and workspace context so gantt mode gets its own eyebrow, tone, description, and meta instead of reusing document-hub copy (`client/src/pages/diagram/DiagramsPage.tsx:161`, `client/src/pages/diagram/DiagramsPage.tsx:178-218`).

### Fix 2: Add a real small-screen gantt treatment

Two changes are needed together:
- give the shared tab rail either `overflow-x-auto` with visible affordance or a wrapped compact variant below `sm`
- give the gantt shell a mobile-specific presentation that exposes the timeline on first render instead of clipping it behind the grid (`client/src/components/ui/tabs.tsx:16-20`, `client/src/components/gantt/GanttTab.tsx:427-432`)

### Fix 3: Use the gantt recovery strings that already exist

Replace `workspace.status.documentsLoadFailed` with `gantt.status.loadFailed` in the gantt error state and use `gantt.status.loadFailedTitle` consistently (`client/src/components/gantt/GanttTab.tsx:372-384`, `client/src/i18n/locales/en/translation.json:665-668`, `client/src/i18n/locales/ko/translation.json:663-666`).

## Minor Recommendations

- Rename the third stats block from `Milestone` to `Legend` or `Status` so the stat count block and legend block are easier to scan apart (`client/src/components/gantt/GanttTab.tsx:463`, `client/src/components/gantt/GanttTab.tsx:467`).

## Files Audited

- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/components/gantt/GanttTab.tsx`
- `client/src/components/gantt/gantt.css`
- `client/src/components/ui/tabs.tsx`
- `client/src/i18n/locales/en/translation.json`
- `client/src/i18n/locales/ko/translation.json`

## Re-review Outcome

**Date:** 2026-04-16  
**Reviewer:** smt-designer-sonnet (`RIS-123`)  
**Verdict:** PASS

Follow-up work resolved the flagged UI defects from the initial audit:

- `client/src/pages/diagram/DiagramsPage.tsx` now branches hero copy, workspace section framing, and gantt-specific project-hub metadata when the gantt tab is active.
- `client/src/components/gantt/GanttTab.tsx` now uses `gantt.status.loadFailed*` for recovery copy and keeps the read-only hint tied to gantt context.
- `client/src/components/ui/tabs.tsx` and `client/src/components/gantt/GanttTab.tsx` now include the small-screen treatment validated in the 390px re-review: the shared tab rail fits within the viewport and the gantt timeline opens in-frame instead of starting grid-only.

Re-review evidence:

- `RIS-123` closed with a `PASS` verdict after live 390x844 verification.
- Local regression verification on the current head also passed: `cd client && npm run build && npm run test:unit` (`308/308`).
- The remaining Vite circular chunk warning (`feature-dsl -> feature-code-sync -> feature-dsl`) is unchanged and non-blocking for Phase 6 closure.

## Initial Verdict

**FLAG**

The gantt chart itself is good. It is stable on desktop, the toolbar is clear, the milestone language is legible, and the token bridge survives both Paper and Graphite.

This is not a chart-quality problem. It is an integration-quality problem. The active gantt tab still inherits document-hub framing, the gantt error state names the wrong surface, and the small-screen layout does not present the timeline confidently enough on first render. Those are real UI defects, but they are fixable without rethinking the gantt core.
