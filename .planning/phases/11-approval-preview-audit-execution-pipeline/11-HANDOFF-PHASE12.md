# Phase 12 Executor Handoff

Phase 11 shipped the approval shell only. It persists sanitized proposals, exposes read-only previews/history, and rejects approval for unsupported actions because no production `AiActionExecutor` beans are registered yet.

## Phase 11 Proof Points

- `AiActionExecutor` is the single write boundary for future AI actions.
- `AiActionExecutorRegistry` resolves executors by exact `actionType`.
- `AiActionProposalService.approve(...)` rechecks pending/expiry/validation, then rejects with `REJECTED` when the registry has no executor.
- Phase 11 registers no production executors; unsupported approval returns `REJECTED` with redacted error metadata.
- Destructive, bulk, SQL, shell, command, and arbitrary execution actions remain excluded by `ActionDraftValidator`.

## Extension Points

Register one Spring bean per action type:

| Action type | Executor boundary | Service boundary | Notes |
| --- | --- | --- | --- |
| `issue.create` | `AiActionExecutor` bean with `actionType() == "issue.create"` | `ProjectIssueService.createProjectIssue(...)` | Create a project issue from sanitized fields only. |
| `issue.update` | `AiActionExecutor` bean with `actionType() == "issue.update"` | `ProjectIssueService.updateProjectIssue(...)` | Update a single project issue after loading the current row. |
| `todo.create` | `AiActionExecutor` bean with `actionType() == "todo.create"` | `ProjectTodoService.createProjectTodo(...)` | Create a requester-owned TODO; WBS linking must stay explicit. |
| `todo.update` | `AiActionExecutor` bean with `actionType() == "todo.update"` | `ProjectTodoService.updateProjectTodo(...)` | Update only a requester-owned TODO unless a future policy expands ownership. |
| `wbs.comment.add` | `AiActionExecutor` bean with `actionType() == "wbs.comment.add"` | `WorkItemHistoryService.addWbsComment(...)` | Append a WBS comment after target WBS existence is revalidated. |
| `wbs.memo.add` | `AiActionExecutor` bean with `actionType() == "wbs.memo.add"` | `WorkItemHistoryService.addWbsComment(...)` or a new memo-specific service | Do not overload comment semantics if memo needs separate retention or visibility. |

## Required Execution Contract

Every Phase 12 executor must:

1. Use `proposal.getTeamId()` and `proposal.getProjectId()` from the persisted proposal, not browser input.
2. Revalidate authorization through the target service call. Do not bypass `ProjectContextLoader` or TODO owner checks.
3. Rehydrate only `proposal.getSanitizedPayloadJson()` into a typed command. Do not trust preview JSON for writes.
4. Check stale state before writing: target row exists, target belongs to the same project, and update fields still make sense against the current row.
5. Return a compact `AiActionExecutor.ExecutionResult` JSON containing identifiers and status only.
6. Let `AiActionProposalService` record decision audit after execution; executor-specific service calls may additionally record domain history where the domain already does so.

## Preview Expectations

`AiActionPreviewService` should be extended before enabling each executor:

- Show target type, id, and label.
- Show changed fields with before/after values for updates.
- Show created content for creates/comments/memos.
- Add warnings for missing assignee, stale dates, duplicate-looking titles, private TODO visibility, and WBS-linked visibility.
- Never include raw provider output, prompts, request context, tokens, cookies, env values, or browser-supplied hidden fields.

## Destructive Exclusions

Do not register executors for:

- delete actions
- bulk actions
- command/shell execution
- SQL execution
- arbitrary HTTP/API execution
- filesystem operations
- permission or membership changes

Unsupported actions must continue to transition to `REJECTED`, not silently no-op and not mutate.

## Verification Commands

Before Phase 12 closes its first executor:

```bash
./gradlew test --tests "*AiActionProposal*" --tests "*AiChat*" --tests "*AiProjectHistory*" --tests "*Ai*Audit*"
cd client && npm run test:unit -- ai-chat-response-cards ai-chat-store ai-chat-api ai-chat-execution ai-history-api project-workspace-tab-order project-ai-history-tab
rg "rawPrompt|rawContext|rawProviderOutput|stdout|stderr|accessToken|refreshToken|cookie|password|SMART_ERD_|SPRING_|env" src/main/java/com/smarterd/api/ai src/main/java/com/smarterd/application/ai client/src/types client/src/api client/src/components/ai client/src/components/project client/src/stores client/src/hooks
```

Phase 11 non-mutating proof:

```bash
rg "implements AiActionExecutor" src/main/java/com/smarterd
rg "ProjectIssueService|ProjectTodoService|WorkItemHistoryService" src/main/java/com/smarterd/application/ai
```

The expected Phase 11 result is no production executor implementation and no direct AI application-service dependency on the project issue, TODO, or work-history write services.
