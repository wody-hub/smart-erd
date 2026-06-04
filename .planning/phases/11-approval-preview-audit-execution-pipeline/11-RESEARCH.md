# Phase 11: Approval Preview + Audit Execution Pipeline - Research

**Researched:** 2026-06-04
**Status:** Complete
**Mode:** inline Codex research

## Research Question

What do we need to know to plan Phase 11 well: turning AI action drafts into persisted, reviewable Smart-ERD proposals with preview, approve/cancel state, safe execution boundaries, and redacted audit/history?

## Inputs Read

- `.planning/phases/11-approval-preview-audit-execution-pipeline/11-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-AI-SPEC.md`
- `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-UI-SPEC.md`
- `README.md`
- Existing AI backend, PM service, frontend chat, and AI tests listed below.

## Findings

### Current AI Action Boundary

- `AiActionDraft` is already a structured provider action skeleton with `id`, `type`, `title`, `summary`, `riskLevel`, `requiresApproval`, and an opaque `payload`.
- `ProviderOutputValidator` validates the provider envelope and delegates draft safety to `ActionDraftValidator`.
- `ActionDraftValidator` currently allows unknown non-destructive draft types when `requiresApproval=true`, and rejects destructive-looking type strings such as `delete`, `remove`, `bulk`, `shell`, `command`, `execute`, and `sql`.
- `AiChatExecutionService` currently treats any returned provider action as a read-only chat violation and returns `READ_ONLY_PROVIDER_ACTION_REJECTED`, deliberately omitting type/payload details from the response.
- Phase 11 should replace that rejection branch with server-side proposal persistence and sanitized response mapping. It should not let provider payloads bypass validation or become browser-local source of truth.

### Proposal Lifecycle Shape

Recommended lifecycle:

| Status | Meaning | Terminal |
|--------|---------|----------|
| `PENDING` | Proposal persisted, preview generated, waiting for user decision | no |
| `CANCELLED` | User cancelled before execution | yes |
| `EXPIRED` | Pending proposal passed retention window | yes |
| `REJECTED` | Approval attempted but validation, authorization, stale-state, or unsupported-executor checks failed | yes |
| `EXECUTED` | Registered executor completed successfully | yes |
| `FAILED` | Registered executor was invoked but failed safely | yes |

Do not use separate `APPROVED` and `EXECUTED` terminal states unless the implementation needs an intermediate durable marker. The user-facing card should distinguish "approved and executed" from "approval rejected" and "execution failed"; a separate persistent decision event can record the approve click.

Key state rules:

- Only `PENDING` can transition.
- Repeated approve/cancel against a terminal status returns the existing status and does not duplicate mutations.
- Expiration should use the same 15 minute retention default established by Phase 9 unless made configurable.
- Approve must re-run authorization, action type validation, target scope validation, payload validation, stale-state checks, executor lookup, and audit writing inside the server transaction boundary.

### Persistence and Redaction

Existing `AiExecutionAudit` is metadata-only and tied to execution lifecycle. Phase 11 needs proposal-level persistence rather than stuffing everything into `ai_execution_audits`.

Recommended backend persistence:

- `AiActionProposal`
  - `id`
  - `proposal_id` stable external UUID/string
  - `execution_id`
  - `provider`
  - `prompt_version`
  - `action_type`
  - `risk_level`
  - `status`
  - `team_id`
  - `project_id`
  - `target_type`
  - `target_id`
  - `target_label`
  - `title`
  - `summary`
  - `requested_by`
  - `decision_by`
  - `decided_at`
  - `expires_at`
  - `sanitized_payload_json`
  - `preview_json`
  - `result_json`
  - `redacted_error_type`
  - `redacted_error_title`
  - `redacted_error_detail`
- Optional event table `AiActionProposalEvent` if the implementation wants a full chronological history. If the plan needs to stay smaller, proposal row fields plus existing audit row are enough for Phase 11, as long as cancel/reject/fail details are preserved.

Storage must stay redaction-first:

- Store sanitized proposal data and sanitized preview data only.
- Do not store raw prompt bundles, raw read context, raw provider stdout/stderr, raw provider payloads that contain unknown nested objects, credentials, cookies, tokens, environment values, or local file paths.
- Persist only a whitelisted, typed payload view needed for preview and later executor handoff.

### Preview and Diff Strategy

The frontend must not compute authoritative diffs from provider payloads. The backend should generate a typed `AiProposalPreviewView` at proposal creation and again or at least revalidate it at approval.

Recommended preview DTO:

- `proposalId`
- `status`
- `executable`
- `actionType`
- `riskLevel`
- `target`: `type`, `id`, `label`, `projectId`, `teamId`
- `summary`
- `fields`: list of `{ label, beforeValue, afterValue, changeType }`
- `content`: exact proposed comment/memo text when applicable
- `warnings`: stale/unsupported/authorization/validation messages safe for users
- `expiresAt`

For Phase 11, concrete low-risk write executors are deferred to Phase 12, so preview generation should still handle unsupported actions safely:

- Known future action type names may be normalized and displayed as non-executable if no executor is registered.
- Unknown or destructive-looking action types should either fail provider validation or become `REJECTED` on approve.
- Approve for unsupported action types must never mutate data and must audit the rejection.

### Execution Boundary

Phase 11 should introduce an application-layer registry such as:

- `AiActionProposalService`: create proposals from provider actions, approve, cancel, expire/read, list history.
- `AiActionProposalValidator`: typed action and target validation, destructive guard, payload whitelist.
- `AiActionPreviewService` or registry preview hook: server-generated preview view.
- `AiActionExecutorRegistry`: maps action type to executor.
- `AiActionExecutor`: interface for Phase 12 concrete issue/TODO/WBS comment actions.

Phase 11 should not register production executors for issue create/update, personal TODO create/update, or WBS comment/work memo add. That belongs to Phase 12. It should prove that no unregistered action can execute and that registered executors, when later added, must receive the authenticated actor and call existing Smart-ERD services.

Future executor targets:

- `ProjectIssueService.createProjectIssue` and `ProjectIssueService.updateProjectIssue`
- `ProjectTodoService.createProjectTodo` and `ProjectTodoService.updateProjectTodo`
- `WorkItemHistoryService.addWbsComment`

### Existing PM Service Boundaries

- Issue create/update already loads project context with write access and validates assignee membership.
- TODO create/update already enforces owner-scoped access via `ProjectTodoAccessService`.
- WBS comment creation already loads project context with write access and verifies target existence.
- Phase 12 should call these services directly from executors; Phase 11 should not duplicate their business rules.

### Frontend Integration

Existing Phase 10 UI facts:

- `AiAnswerCard` renders conclusion, source chips, confirmed facts, interpretation, and needs-confirmation sections.
- `AiChatDrawer` already keeps messages while navigating.
- `useAiChatStore` persists sanitized rendered messages by login id and currently whitelists only response status, facts, interpretation, source chips, confirmation candidates, execution id, and errors.
- `useAiChatExecution` normalizes chat responses before appending assistant messages.
- `aiChatApi.ts` is the only chat POST boundary.

Phase 11 UI should:

- Extend `AiChatResponse` with sanitized `proposals: AiActionProposalCard[]`.
- Render proposal cards inside `AiAnswerCard` after the current answer sections or after source chips according to final UI-SPEC.
- Add approve/cancel mutations against proposal id.
- Update the stored assistant message response in place when a proposal reaches a terminal state, so route changes preserve the visible card state.
- Store only sanitized card fields and preview summary in local storage; never store raw payload.
- Add project AI history read surface in project context using existing project tab or workspace panel patterns. The history surface is read-only.

### Endpoint Shape

Recommended API surface:

- `POST /api/ai/chat`
  - continues to return answer sections and now includes sanitized `proposals`.
- `POST /api/ai/proposals/{proposalId}/approve`
  - revalidates and transitions the persisted proposal.
- `POST /api/ai/proposals/{proposalId}/cancel`
  - cancels a pending proposal or returns existing terminal state.
- `GET /api/ai/proposals/{proposalId}`
  - optional, useful for refresh after route changes or stale local state.
- `GET /api/teams/{teamId}/projects/{projectId}/ai-history`
  - project-scoped read-only execution/proposal/decision history.

The approve/cancel endpoints can live under `/api/ai` because proposal id carries scope and the service revalidates authorization. The history endpoint should live under the project route because the UI surface is project-contextual and project authorization is explicit in the path.

### Tests to Preserve and Change

Backend:

- Keep destructive draft validation tests and add explicit cases for `bulk`, `sql`, `command`, and missing approval.
- Replace the current chat test that expects `READ_ONLY_PROVIDER_ACTION_REJECTED` with tests that verify provider actions become sanitized persisted proposals.
- Add service tests for:
  - proposal creation stores sanitized payload/preview and not raw payload keys.
  - approve revalidates authorization and stale/executor state.
  - cancel is terminal and idempotent.
  - unsupported action approve rejects and audits without mutation.
  - terminal approve/cancel does not duplicate execution.
  - project history lists sanitized execution/proposal/decision metadata.

Frontend:

- Extend `ai-chat-response-cards.test.ts` to verify proposal card order, visible summary/target/changed fields/risk, and no raw payload JSON.
- Extend `ai-chat-store.test.ts` to verify local persistence strips raw payload and preserves sanitized proposal card state.
- Add unit tests for approve/cancel mutation result normalization.
- Add a smoke/E2E path only if Phase 11 exposes enough UI without Phase 12 concrete executors; otherwise use unit/component tests for cards and project history.

## Validation Architecture

### Required Automated Coverage

| Area | Command | Required Proof |
|------|---------|----------------|
| Backend proposal domain/service | `./gradlew test --tests '*AiActionProposal*'` | proposal state transitions, sanitization, unsupported rejection, idempotency |
| Backend chat integration | `./gradlew test --tests '*AiChat*'` | provider action becomes sanitized proposal in chat response |
| Backend audit/history API | `./gradlew test --tests '*Ai*History*' --tests '*Ai*Audit*'` | redacted history and proposal decision metadata |
| Frontend card/rendering | `cd client && npm run test:unit -- ai-chat-response-cards` | proposal cards visible in answer without raw payload |
| Frontend persistence/API | `cd client && npm run test:unit -- ai-chat-store ai-chat-api ai-chat-execution` | sanitized local state and approve/cancel request shape |

### Manual Verification

- Open the AI drawer, trigger or mock a provider answer with one or more proposals, and confirm each card appears inside the originating answer.
- Approve/cancel each proposal independently and verify the card state changes in place.
- Navigate away and back; the drawer and sanitized terminal card state remain visible.
- Open project AI history and verify it lists recent execution/proposal/decision records without raw prompt/context/payload.

### Security Checks

- Search generated backend/frontend response mappers and storage serializers for `payload`, `stdout`, `stderr`, `prompt`, `readContext`, `token`, `cookie`, `env`, and verify only sanitized/allowed fields leave the backend or enter local storage.
- Test a destructive-looking action type such as `issue.delete` and `wbs.bulkCreate`; it must not create an executable proposal or mutate data.
- Test a valid-looking but unsupported action type such as `issue.create`; approve must reject safely until Phase 12 registers an executor.

## Recommended Plan Slices

1. Backend proposal persistence and lifecycle core.
2. Backend chat-to-proposal conversion, preview mapping, approve/cancel API, and project history API.
3. Frontend types/API/store normalization plus proposal cards and approve/cancel mutations.
4. Project AI history read-only UI surface.
5. Cross-cutting tests, redaction audit, and documentation of Phase 12 executor handoff.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Scope creep into concrete writes | Keep Phase 11 executor registry empty for production and assert unsupported actions cannot mutate |
| Raw payload leakage | Whitelist sanitized DTOs and add store/response tests that search for raw payload keys |
| Stale proposal approval | Store creation-time target assumptions and revalidate target/current state before execution |
| Cross-project history leakage | Use project route authorization and requester/owner privacy checks for personal TODO proposals |
| Ambiguous action type taxonomy | Define normalized action type enum/registry contract now and hand concrete action registration to Phase 12 |

## Research Complete

Phase 11 can be planned as a generic proposal, approval, preview, and audit shell over existing Phase 9/10 AI surfaces. The safest implementation keeps production executors unregistered until Phase 12, while still building the server-side lifecycle, sanitized UI card model, idempotent approve/cancel endpoints, and project AI history required for later low-risk writes.
