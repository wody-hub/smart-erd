---
phase: 05-wbs-milestone
reviewed: 2026-04-15T09:30:00Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - client/src/api/milestoneApi.ts
  - client/src/api/wbsApi.ts
  - client/src/constants/query-keys.ts
  - client/src/hooks/useProjectQueryInvalidation.ts
  - client/src/lib/format.ts
  - client/src/pages/diagram/DiagramsPage.tsx
  - client/src/types/milestone.ts
  - client/src/types/wbs.ts
  - client/src/components/milestone/MilestoneFormDialog.tsx
  - client/src/components/milestone/MilestonePanel.tsx
  - client/src/components/wbs/SortableWbsRow.tsx
  - client/src/components/wbs/wbs-tree-utils.ts
  - client/src/components/wbs/WbsItemFormDialog.tsx
  - client/src/components/wbs/WbsTab.tsx
  - src/main/java/com/smarterd/api/project/dto/BusinessOverviewResponse.java
  - src/main/java/com/smarterd/api/project/MilestoneController.java
  - src/main/java/com/smarterd/api/project/WbsController.java
  - src/main/java/com/smarterd/api/project/dto/milestone/CreateMilestoneRequest.java
  - src/main/java/com/smarterd/api/project/dto/milestone/MilestoneResponse.java
  - src/main/java/com/smarterd/api/project/dto/milestone/UpdateMilestoneRequest.java
  - src/main/java/com/smarterd/api/project/dto/wbs/CreateWbsItemRequest.java
  - src/main/java/com/smarterd/api/project/dto/wbs/ReorderWbsItemsRequest.java
  - src/main/java/com/smarterd/api/project/dto/wbs/UpdateWbsItemRequest.java
  - src/main/java/com/smarterd/api/project/dto/wbs/WbsItemResponse.java
  - src/main/java/com/smarterd/api/project/dto/wbs/WbsReorderItemRequest.java
  - src/main/java/com/smarterd/config/support/ClockConfig.java
  - src/main/java/com/smarterd/domain/pm/common/ProjectContextLoader.java
  - src/main/java/com/smarterd/domain/pm/milestone/entity/Milestone.java
  - src/main/java/com/smarterd/domain/pm/milestone/repository/MilestoneRepository.java
  - src/main/java/com/smarterd/domain/pm/milestone/repository/MilestoneRepositoryCustom.java
  - src/main/java/com/smarterd/domain/pm/milestone/repository/MilestoneRepositoryCustomImpl.java
  - src/main/java/com/smarterd/domain/pm/milestone/service/MilestoneService.java
  - src/main/java/com/smarterd/domain/pm/wbs/entity/WbsItem.java
  - src/main/java/com/smarterd/domain/pm/wbs/repository/WbsItemRepository.java
  - src/main/java/com/smarterd/domain/pm/wbs/repository/WbsItemRepositoryCustom.java
  - src/main/java/com/smarterd/domain/pm/wbs/repository/WbsItemRepositoryCustomImpl.java
  - src/main/java/com/smarterd/domain/pm/wbs/service/WbsProgressProvider.java
  - src/main/java/com/smarterd/domain/pm/wbs/service/WbsService.java
  - src/main/java/com/smarterd/domain/project/service/ProjectProgressProvider.java
  - src/main/java/com/smarterd/domain/project/service/ProjectService.java
  - src/main/java/com/smarterd/domain/common/message/MessageCode.java
  - src/main/resources/db/migration/V20260414_02__phase5_wbs_milestone_tables.sql
  - src/main/resources/i18n/messages.properties
  - src/main/resources/i18n/messages_ko.properties
  - src/test/java/com/smarterd/api/project/MilestoneControllerMvcTest.java
  - src/test/java/com/smarterd/api/project/WbsControllerMvcTest.java
  - src/test/java/com/smarterd/domain/pm/milestone/service/MilestoneServiceTest.java
  - src/test/java/com/smarterd/domain/pm/wbs/service/WbsServiceTest.java
  - src/test/java/com/smarterd/domain/project/service/ProjectServiceTest.java
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 5: Code Review Report (Re-Review)

**Reviewed:** 2026-04-15T09:30:00Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** clean

## Summary

This is a re-review after fixes were applied for 4 warnings (WR-01 through WR-04) from the previous review. All fixes have been verified as correct, and no new issues were introduced.

### Previous Fix Verification

**WR-01/WR-04 (wbs-tree-utils.ts `buildReorderPayload`):** Verified. The function now correctly uses `affectedParentKeys` (a `Set` containing only `previousKey` and `nextKey`, line 262) to iterate only the affected parent groups (line 301). The `originalById` map comparison (line 306) correctly skips items where both `parentId` and `sortOrder` are unchanged. This eliminates the previous over-sending of unchanged items in the reorder payload.

**WR-02 (WbsItemFormDialog.tsx `WbsItemFormValues`):** Verified. The interface now includes a JSDoc block (lines 30-35) that explicitly documents the intentional exclusion of `assigneeUserId`, explaining it is handled via separate UX/permission policy.

**WR-03 (MilestoneFormDialog.tsx, WbsItemFormDialog.tsx `mutateAsync` contract):** Verified. Both files now include contract guard comments above the `await onSubmit(...)` call (MilestoneFormDialog.tsx line 73, WbsItemFormDialog.tsx line 156) documenting that `onSubmit` must be a `mutateAsync`-based Promise.

### Full Re-Review Findings

The complete codebase was re-examined at standard depth. Key observations:

**Backend:**
- Architecture follows SOLID principles correctly. `ProjectProgressProvider` interface + `WbsProgressProvider` implementation is a clean DIP application.
- `ProjectContextLoader` properly extracts repeated auth/team/project verification logic (SRP).
- All controllers use `@Valid` on request bodies; DTOs have proper Bean Validation annotations with i18n message codes.
- Transaction patterns are correct: class-level `@Transactional(readOnly = true)`, method-level `@Transactional` for writes.
- Entity invariants (depth, progress rate, date ordering, estimated M/M) are validated both at the DTO layer (Bean Validation) and entity layer (`validateInvariants()`).
- QueryDSL custom repository pattern is followed correctly (no `@Repository` on Impl classes, `JPAQueryFactory` via constructor injection).
- Reorder cycle detection in `WbsService.computeDepth()` uses a `visiting` set with proper cleanup -- correct.
- `Clock` bean injection enables testable date logic in `MilestoneService`.
- DB migration uses appropriate constraints (`CHECK`, `ON DELETE CASCADE/SET NULL`), indexes, and `TIMESTAMPTZ` columns.
- i18n message codes are registered in both `messages.properties` and `messages_ko.properties`.

**Frontend:**
- React Query patterns used consistently with `useQuery`/`useMutation`, proper `invalidateQueries`, and `toast.error(getErrorMessage(...))`.
- `useProjectQueryInvalidation` hook correctly centralizes cross-domain cache invalidation (WBS + milestones + business overview).
- Page component code ordering in `WbsTab` and `MilestonePanel` follows project conventions.
- All interactive elements have proper `aria-label` attributes.
- Design token system followed (semantic classes like `bg-card`, `text-muted-foreground`, `bg-accent`, `text-destructive`).
- Types defined in `types/` directory, constants in `constants/`, API functions in `api/` -- no magic strings.
- JSDoc present on all public interfaces, functions, and state variables.
- DnD tree reorder logic (`projectPlacement`, `buildReorderPayload`) handles edge cases: descendant-into-self prevention, max depth validation, empty payload short-circuit.

All reviewed files meet quality standards. No issues found.

---

_Reviewed: 2026-04-15T09:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
