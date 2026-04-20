# Phase 06.1 Summary

## Delivered

- Added the dedicated WBS workspace route at `/teams/:teamId/projects/:projectId/wbs` and wired it through [`client/src/constants/routes.ts`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/constants/routes.ts) and [`client/src/App.tsx`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/App.tsx).
- Split the WBS authoring surface into the shared [`client/src/components/wbs/WbsWorkspaceContent.tsx`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/WbsWorkspaceContent.tsx), reused by the project-hub tab and the dedicated page.
- Closed the assignee UX in the shared dialog/table path via [`client/src/components/wbs/WbsItemFormDialog.tsx`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/WbsItemFormDialog.tsx) and [`client/src/components/wbs/SortableWbsRow.tsx`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/SortableWbsRow.tsx).
- Implemented dedicated-only inline quick-add rows with repeatable root/child append behavior in [`client/src/components/wbs/WbsInlineCreateRow.tsx`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/WbsInlineCreateRow.tsx).
- Locked the quick-add payload contract to explicit defaults, including `progressRate: 0`, in [`client/src/components/wbs/wbs-tree-utils.ts`](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/wbs-tree-utils.ts) with regression coverage in [`client/test/unit/wbs-inline-create.test.ts`](/Users/j.jaeyo/Project/ETC/smart-erd/client/test/unit/wbs-inline-create.test.ts).

## Scope Note

- Phase 6.1 accepts inline append for:
  - the table-bottom root row
  - expanded parent-group footer rows
- Leaf-first-child inline append was not added in this phase. This matches the approved UI spec and execute-plan contract that narrowed WBS-07 before execution.

## Verification

- `cd client && npm run build`
- `cd client && npm run test:unit`
- Manual smoke on the running test stack (`frontend: http://localhost:4502`, `backend: http://localhost:9502`):
  - project-hub `WBS` tab shows `작업공간 열기`
  - dedicated `/wbs` route loads directly after refresh
  - dialog assignee selector loads team members, saves, and the table reflects the owner pill
  - dedicated-only root quick-add renders on the page while the compact tab keeps quick-add hidden
  - root quick-add keeps the same row active after a successful append instead of collapsing back to the prompt
  - dedicated back navigation returns to the project hub with the `WBS` tab active
  - smoke-created WBS rows were deleted after verification so the project state returned to empty

## Notable Fixes During Smoke

- The initial extraction caused quick-add rows to remount after create, which collapsed the active input and broke repeat append.
- The final implementation keeps quick-add rows keyed as top-level table siblings so the same row instance survives anchor movement after create.
