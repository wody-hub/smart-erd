# Phase 12: Low-Risk Write Tools MVP - Research

**Date:** 2026-06-04
**Status:** Ready for execution planning

## Scope Finding

Phase 11 already provides the approval-preview shell:

- `AiActionProposalService.approve(...)` reloads a persisted proposal by id, verifies project access, validates lifecycle state, checks expiry, resolves the executor registry, and marks the proposal terminal.
- `AiActionExecutorRegistry` is the only supported mutation boundary for AI-approved writes.
- `AiActionProposalSanitizer` keeps only top-level payload keys `targetType`, `targetId`, `targetLabel`, `projectId`, `teamId`, `fields`, `content`, `assumptions`, and `labels`, while recursively filtering sensitive keys.
- `AiActionPreviewService` renders preview fields from sanitized payload data only.

Phase 12 should therefore register exact executors and preserve the Phase 11 invariant: browser approval sends only `proposalId`, and mutation reads only server-owned persisted proposal state.

## Existing Write Boundaries

### Issues

`ProjectIssueService` supports:

- `createProjectIssue(loginId, teamId, projectId, CreateProjectIssueCommand)`
- `updateProjectIssue(loginId, teamId, projectId, issueId, UpdateProjectIssueCommand)`
- status advancement helpers that enforce next-status transition

It does not currently expose a single issue read method. Add `getProjectIssue(...)` so AI update executors can merge partial fields with current state through the service boundary instead of reaching into repositories.

Supported MVP fields:

- `title`
- `description`
- `priority`
- `assigneeUserId`

Issue status changes are intentionally excluded from Phase 12 MVP because the existing status service has transition semantics separate from generic update.

### Personal TODOs

`ProjectTodoService` already supports:

- `getProjectTodo(loginId, teamId, projectId, todoId)`
- `createProjectTodo(loginId, teamId, projectId, CreateProjectTodoCommand)`
- `updateProjectTodo(loginId, teamId, projectId, todoId, UpdateProjectTodoCommand)`

The access service enforces requester-owned TODO lookup for updates. Phase 12 should use these methods directly.

Supported MVP fields:

- `title`
- `description`
- `status`
- `priority`
- `targetDate`
- `progressRate`
- `linkedWbsItemId` only on create

TODO delete, document linking, and WBS link/unlink updates remain out of scope.

### WBS Comments and Memos

`WorkItemHistoryService.addWbsComment(loginId, teamId, projectId, wbsItemId, content)` validates project access, write permission, and WBS target existence before saving a comment.

Use this service for both:

- `wbs.comment.add`
- `wbs.memo.add`

The persisted comment model does not distinguish comment from memo. Phase 12 can still distinguish the AI action in proposal result/history metadata. A dedicated memo table or activity type is deferred.

## Payload Contract

Executors should parse `proposal.getSanitizedPayloadJson()` with Jackson and accept only this structure:

```json
{
  "targetType": "issue|todo|wbs",
  "targetId": "123",
  "targetLabel": "Display label",
  "fields": [
    { "name": "title", "beforeValue": "Old", "afterValue": "New" },
    { "name": "priority", "afterValue": "HIGH" }
  ],
  "content": "Comment or memo text"
}
```

Field names are canonical English identifiers. UI labels are display-only. `afterValue` is the proposed value, and `beforeValue` is optional stale-state evidence.

Executors must fail closed when:

- required fields are absent or blank
- action type and target type do not match
- target id is missing where required
- a field name is not in the allowlist for that action
- enum, number, or date values cannot be parsed
- optional `beforeValue` does not match the current server value

## Result Contract

Executor result JSON should remain compact and safe:

```json
{
  "actionType": "issue.create",
  "resourceType": "issue",
  "resourceId": "123",
  "targetLabel": "Display label",
  "status": "created",
  "summary": "Issue created."
}
```

No result may include raw payload JSON, prompt text, provider output, stack traces, stdout/stderr, tokens, cookies, environment values, filesystem paths, or SQL.

## UI Impact

Backend `AiActionProposalView` and `AiActionProposalResponse` do not currently expose result metadata. Add a sanitized `result` object so executed proposal cards and project AI history can show what changed without revealing raw payload.

Frontend `AiProposalPanel` can reuse the Phase 11 card. Add only:

- localized approve label `승인 후 실행`
- executed result section
- safe failed/rejected helper text
- React Query invalidation after an executed proposal

## Recommended Plan Shape

1. Shared executor payload/result helpers and safe result DTO exposure.
2. Issue create/update executors.
3. TODO create/update executors.
4. WBS comment/memo executors and destructive/non-mutation guard tests.
5. Frontend result display, query invalidation, summaries, and final verification.

## Key Risks

- **Authorization bypass:** executors must call existing services with `loginId`, `teamId`, and `projectId`; never repositories.
- **Payload tampering:** executor input is persisted sanitized JSON only; preview/browser values are ignored.
- **Stale mutation:** optional `beforeValue` must be checked against current server values before update.
- **Privacy leak:** TODO history and result metadata must not expose private TODO detail to other users.
- **Audit gap:** every terminal path must keep Phase 11 audit behavior and safe result/error metadata.
