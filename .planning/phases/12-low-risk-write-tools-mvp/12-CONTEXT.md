# Phase 12: Low-Risk Write Tools MVP - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning
**Mode:** auto-selected recommendations

<domain>
## Phase Boundary

Phase 12 registers the first concrete low-risk AI write executors on top of the Phase 11 approval-preview/audit shell. After an AI answer creates a sanitized persisted proposal, the user can approve practical issue, personal TODO, and WBS comment/work memo actions. The actual mutation must happen through existing Smart-ERD domain/application service boundaries after server-side authorization, target validation, stale-state checks, and payload allowlisting.

This phase does not add destructive actions, bulk actions, direct DB writes, arbitrary shell/API execution, hosted provider support, or policy-based auto-execution. Approval remains mandatory.

</domain>

<decisions>
## Implementation Decisions

### Action Scope
- **D-01:** Register concrete executors for the Phase 11 handoff action types: `issue.create`, `issue.update`, `todo.create`, `todo.update`, `wbs.comment.add`, and `wbs.memo.add`.
- **D-02:** Keep the MVP field surface intentionally narrow. Support title/status/priority/assignee/due-date style issue fields only when existing service request DTOs already support them; support requester-owned personal TODO fields only; support WBS comment/memo text append only.
- **D-03:** Treat all delete, bulk destructive, shell, SQL, filesystem, membership, permission, and arbitrary HTTP/API actions as unsupported. They must be rejected before mutation and covered by tests.

### Execution Boundary
- **D-04:** Each action type gets a dedicated Spring `AiActionExecutor` bean with exact `actionType()` matching; no generic catch-all executor is allowed.
- **D-05:** Executors must deserialize only `proposal.getSanitizedPayloadJson()` into typed command records. They must never use preview JSON or browser-supplied fields for writes.
- **D-06:** Executors must use `proposal.getTeamId()`, `proposal.getProjectId()`, `proposal.getRequestedBy()`, and persisted target metadata from the proposal. Browser input may identify only the proposal id.
- **D-07:** Executors must call existing service boundaries (`ProjectIssueService`, `ProjectTodoService`, `WorkItemHistoryService`) instead of repositories or direct DB writes.

### Authorization, Ownership, and Stale-State Rules
- **D-08:** Approval already reloads and project-authorizes the persisted proposal in `AiActionProposalService`; each executor still revalidates target existence and same-project ownership immediately before mutation.
- **D-09:** Issue update must load the current issue and confirm it belongs to the proposal project before applying allowlisted updates.
- **D-10:** TODO create/update is requester-owned by default. Phase 12 must not let AI create or update another member's private TODO unless an existing service policy explicitly allows it.
- **D-11:** WBS comment and work memo additions must target an existing WBS item in the proposal project. Memo can share the existing history/comment boundary only if visibility and retention semantics remain correct.
- **D-12:** Stale, invalid, unauthorized, rejected, expired, unsupported, or failed proposals must not mutate data. Terminal idempotency from Phase 11 remains intact.

### Result, Audit, and UI Feedback
- **D-13:** Executor results must be compact metadata only: action type, created/updated resource id, target label, status, and optional safe summary. No raw payload, provider output, stack trace, token, cookie, environment, prompt, or read context.
- **D-14:** Existing proposal card behavior remains the primary UI. Approved proposals update in place to `EXECUTED`/`FAILED`/`REJECTED`; no separate modal-first flow is introduced.
- **D-15:** Frontend should invalidate/refetch proposal/history queries and the affected project resource query families after successful execution where the result identifies the affected domain.
- **D-16:** Project AI history remains the audit review surface and should show sanitized executed/failed result metadata.

### Planning and Verification Expectations
- **D-17:** Security enforcement is mandatory. Every PLAN must include STRIDE threats for authorization bypass, tampering with payloads, stale-state mutation, privacy leakage, and repudiation/audit gaps.
- **D-18:** Tests must prove both positive execution and negative non-mutation paths for each domain group.
- **D-19:** Raw-key exposure scans from Phase 11 remain required after executor registration.

### the agent's Discretion
- The planner may choose whether to group executors by domain or by shared executor infrastructure, as long as dependencies make review and rollback straightforward.
- The planner may choose exact typed command names and helper classes.
- The planner may decide whether WBS memo uses `WorkItemHistoryService.addWbsComment(...)` or a new memo-specific boundary after inspecting current history semantics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Scope
- `.planning/PROJECT.md` - v1.1 AI write principle, Smart-ERD service boundary constraints, and Phase 12 current state.
- `.planning/REQUIREMENTS.md` - AI-WRITE-01 through AI-WRITE-05 and v1.1 out-of-scope destructive/direct execution constraints.
- `.planning/ROADMAP.md` - Phase 12 goal, dependency on Phase 11, success criteria, and UI hint.
- `README.md` - project architecture and local development/test commands.

### Phase 11 Contracts
- `.planning/phases/11-approval-preview-audit-execution-pipeline/11-HANDOFF-PHASE12.md` - exact action type names, executor boundaries, stale-state checks, destructive exclusions, and verification commands.
- `.planning/phases/11-approval-preview-audit-execution-pipeline/11-SECURITY.md` - trust boundaries and closed Phase 11 threat model that Phase 12 must preserve.
- `.planning/phases/11-approval-preview-audit-execution-pipeline/11-VERIFICATION.md` - verified proposal/approval/audit/history behavior and no-executor baseline.
- `.planning/phases/11-approval-preview-audit-execution-pipeline/11-UI-REVIEW.md` - Phase 11 UI contract fixes to preserve in proposal cards and history.

### AI Proposal Backend
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java` - approval lifecycle, authorization revalidation, registry call site, and audit hooks.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionExecutorRegistry.java` - executor lookup boundary.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionExecutor.java` - executor interface contract.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalSanitizer.java` - sanitized payload allowlist/redaction behavior.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionPreviewService.java` - server-owned proposal preview mapping.
- `src/main/java/com/smarterd/application/ai/validation/ActionDraftValidator.java` - destructive/non-approved action guard.
- `src/main/java/com/smarterd/application/ai/AiExecutionAuditService.java` - metadata-only proposal creation/decision/execution audit writers.
- `src/main/java/com/smarterd/domain/ai/AiActionProposal.java` - persisted proposal fields and terminal lifecycle rules.

### Existing Write Service Boundaries
- `src/main/java/com/smarterd/domain/pm/issue/service/ProjectIssueService.java` - issue create/update/status service boundary.
- `src/main/java/com/smarterd/api/project/ProjectIssueController.java` - issue request/response API shape to mirror for payload labels.
- `src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` - personal TODO create/update/link service boundary and owner policy.
- `src/main/java/com/smarterd/api/project/ProjectTodoController.java` - TODO request/response API shape to mirror for payload labels.
- `src/main/java/com/smarterd/domain/pm/history/service/WorkItemHistoryService.java` - WBS comment/activity boundary.
- `src/main/java/com/smarterd/api/project/WbsController.java` - WBS comment/history API shape.

### Frontend Proposal and History Surfaces
- `client/src/components/ai/AiProposalPanel.tsx` - proposal card controls and terminal state rendering.
- `client/src/components/ai/AiProposalPreview.tsx` - preview/warning rendering.
- `client/src/hooks/useAiChatExecution.ts` - proposal decision controller and message update flow.
- `client/src/api/aiChatApi.ts` - proposal approve/cancel API helpers.
- `client/src/api/aiHistoryApi.ts` - project AI history API helper.
- `client/src/stores/useAiChatStore.ts` - sanitized persisted proposal card state.
- `client/src/constants/query-keys.ts` - AI proposal/history query keys and affected query invalidation points.

### Architecture Maps
- `.planning/codebase/STACK.md` - Java/Spring/React/PostgreSQL stack and verification commands.
- `.planning/codebase/ARCHITECTURE.md` - API/Application/Domain layering, transaction and error patterns.
- `.planning/codebase/INTEGRATIONS.md` - JWT auth, DB, i18n, and local/E2E integration environment.
- `.planning/codebase/CONCERNS.md` - security concerns, migration risks, and testing gaps to avoid worsening.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AiActionExecutor` and `AiActionExecutorRegistry` are the single approved executor extension point.
- `AiActionProposalService.approve(...)` already reloads the persisted proposal and revalidates project access before executor lookup.
- `AiActionProposalSanitizer` and `AiActionProposalView` already separate browser-visible state from sanitized payload JSON.
- `ProjectIssueService`, `ProjectTodoService`, and `WorkItemHistoryService` are the existing write boundaries to reuse.
- `AiProposalPanel` and `ProjectAiHistoryTab` already render proposal terminal states and project AI history without requiring a new major UI surface.

### Established Patterns
- Backend API controllers stay thin; write behavior belongs in application/domain services.
- Backend write methods are transactional and enforce authorization/ownership through existing loaders/services.
- Frontend HTTP calls go through typed API modules and React Query/Zustand boundaries.
- User-facing errors and validation failures should remain localized and redacted.
- GSD security enforcement is enabled; plans must include threat models and verification must produce a security report.

### Integration Points
- Register executor beans under `src/main/java/com/smarterd/application/ai/proposal` or a focused subpackage.
- Extend preview mapping if Phase 12 payloads need domain-specific field labels/warnings.
- Add tests around `AiActionProposalService` approval paths once executors are present.
- Add domain-specific executor tests to prove positive writes and negative non-mutation behavior.
- Add frontend invalidation/terminal-result tests only where backend result shape changes what the user sees.

</code_context>

<specifics>
## Specific Ideas

- Phase 12 should be useful but conservative: all approved writes still require the Phase 11 approval card.
- The first executable actions should feel like normal Smart-ERD issue/TODO/WBS operations, not a special AI bypass.
- If a payload is ambiguous, missing required target data, or attempts to update a field outside the MVP allowlist, reject safely and show a terminal failure/rejection.
- The project history tab is the place to verify what AI did after approval.

</specifics>

<deferred>
## Deferred Ideas

- WBS schedule, assignee, progress, milestone create/update, report/document generation, hosted provider support, policy-based auto-execute, and external MCP/API integrations remain future requirements.
- Delete/destructive/bulk actions stay out of v1.1.
- Broad all-team write history browsing remains outside Phase 12.

</deferred>

---

*Phase: 12-Low-Risk Write Tools MVP*
*Context gathered: 2026-06-04*
