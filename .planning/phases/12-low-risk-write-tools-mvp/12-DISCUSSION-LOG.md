# Phase 12: Low-Risk Write Tools MVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 12-Low-Risk Write Tools MVP
**Mode:** auto-selected recommendations per user request
**Areas discussed:** Action scope, execution boundary, authorization/stale-state rules, result/audit/UI feedback, verification depth

---

## Action Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All Phase 11 handoff action types | Register `issue.create`, `issue.update`, `todo.create`, `todo.update`, `wbs.comment.add`, and `wbs.memo.add` with narrow field allowlists. | yes |
| Single-domain MVP first | Implement only issue actions and defer TODO/WBS to later gap plans. | |
| One generic executor | Route all action types through a shared map-based executor. | |

**User's choice:** Auto-selected recommendation: all Phase 11 handoff action types.
**Notes:** The phase success criteria explicitly cover issue, TODO, and WBS comment/memo actions. A generic catch-all executor was rejected because it weakens exact action-type safety.

---

## Execution Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated executor per action type | One Spring `AiActionExecutor` bean per exact action type; use existing domain services. | yes |
| Domain grouped executors | One executor per domain internally branching on action type. | |
| Repository-level writes | Executors write directly through repositories for speed. | |

**User's choice:** Auto-selected recommendation: dedicated executor per exact action type.
**Notes:** Direct repository writes were rejected because they bypass existing service authorization, invariants, and audit/domain side effects.

---

## Authorization and Stale-State Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Strict revalidation | Approval reloads persisted proposal, then executor reloads target and validates same-project/ownership immediately before mutation. | yes |
| Trust Phase 11 approval only | Rely on proposal-service authorization and skip executor target reloads. | |
| Trust preview data | Use server-generated preview as the write source. | |

**User's choice:** Auto-selected recommendation: strict revalidation.
**Notes:** Preview is user-visible explanation only, not authoritative write data.

---

## Result, Audit, and UI Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 11 proposal cards/history | Keep proposal card terminal updates and project AI history as the main feedback surfaces; add query invalidation as needed. | yes |
| Add a new execution modal | Add a separate execution review/result dialog. | |
| Append new assistant messages | Add a new chat message after each approval. | |

**User's choice:** Auto-selected recommendation: reuse Phase 11 proposal cards/history.
**Notes:** This preserves traceability in the originating answer and avoids extra UI scope.

---

## Verification Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Positive and negative non-mutation tests | Test each domain group's successful execution plus invalid, unauthorized, stale, unsupported, and destructive non-mutation paths. | yes |
| Happy path only | Test approved actions only. | |
| Manual verification only | Rely on UI/manual review. | |

**User's choice:** Auto-selected recommendation: positive and negative non-mutation tests.
**Notes:** Phase 12 introduces real writes, so security and regression tests are mandatory.

---

## the agent's Discretion

- Exact command record names, helper class names, and package split.
- Whether WBS memo shares `WorkItemHistoryService.addWbsComment(...)` or requires a new memo-specific service after inspecting current semantics.
- Exact query invalidation list, based on the affected domain returned by executor results.

## Deferred Ideas

- Delete/destructive/bulk actions.
- WBS schedule/assignee/progress edits.
- Milestone create/update.
- Hosted provider support and policy-based auto-execute.
