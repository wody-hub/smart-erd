# Phase 11: Approval Preview + Audit Execution Pipeline - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 turns AI write intent into explicit Smart-ERD action proposals that can be reviewed before any project mutation occurs. It defines the structured proposal contract, server-side proposal validation, preview/diff generation, approve/cancel lifecycle, execution boundary, and audit/history storage for prompts, proposals, decisions, execution results, and errors.

This phase does not add concrete low-risk write tools for issue create/update, personal TODO create/update, or WBS comment/work memo add. Those concrete action executors belong to Phase 12. Phase 11 should build the generic proposal/approval/audit pipeline and make unsupported action handling explicit and safe.

</domain>

<decisions>
## Implementation Decisions

### Proposal Display Flow
- **D-01:** Action proposals first appear inside the AI answer as approval cards, directly under the answer that produced them.
- **D-02:** If a provider returns multiple proposals, each proposal is rendered as its own card with its own approve and cancel controls.
- **D-03:** Proposal cards show summary, target, changed fields, and risk level by default.
- **D-04:** Proposal cards must not expose raw provider JSON, raw payload, raw prompt, raw context, or provider stdout/stderr to normal users.
- **D-05:** Proposal cards remain attached to the chat message after approval, cancellation, expiry, or execution failure. The card state changes in place so the user can see what happened in the original conversation context.
- **D-06:** The current Phase 10 facts/interpretation/source chip answer structure stays intact; proposals are an additional section, not a replacement for confirmed facts.

### Preview and Diff Depth
- **D-07:** Approval requires a server-generated preview before mutation. The frontend renders typed preview data; it must not compute authoritative diffs from provider payloads.
- **D-08:** For update proposals, preview should show field-level before/after values from the current authoritative project data.
- **D-09:** For create proposals, preview should show the proposed field values, target location, and any server-defaulted values that will be applied.
- **D-10:** For comment or memo proposals, preview should show the target path plus the exact content to be added.
- **D-11:** If the target cannot be loaded, authorization fails, required fields are invalid, the proposal is stale, or the current state no longer matches the proposal assumptions, approval is blocked and the UI shows a refresh/retry-safe error state.
- **D-12:** Diff presentation should be typed and user-readable. Do not show implementation payload keys unless the planner intentionally maps them to labels.

### Approval Execution State
- **D-13:** Proposals are persisted server-side as pending proposal records linked to the provider execution, chat answer context, team, project, proposed target, and requesting user.
- **D-14:** Approve and cancel use server endpoints against the persisted proposal id, not browser-only state.
- **D-15:** Approving a proposal re-runs authorization, action type validation, payload validation, target scope validation, and stale-state checks immediately before execution.
- **D-16:** Pending proposals expire by default after a short window aligned with the existing AI execution retention policy. Use 15 minutes unless research finds a strong reason to configure a different default.
- **D-17:** Terminal proposal states are immutable. Repeated approve/cancel requests for an approved, cancelled, expired, executed, or failed proposal return the current terminal status without duplicating mutations.
- **D-18:** Concrete domain mutations should execute only through an action executor registry or equivalent application-layer boundary that calls existing Smart-ERD services or APIs. Phase 12 registers the first concrete low-risk executors.
- **D-19:** Unsupported action types may be stored and displayed as non-executable proposals, but approve must reject them safely and record the rejection.

### Audit and History
- **D-20:** Audit storage remains redaction-first. Store metadata, sanitized proposal data, sanitized preview/diff, decision, execution status, and redacted errors; never store raw prompt, raw provider context, raw provider output, credentials, access tokens, cookies, or broad environment values.
- **D-21:** Audit records should link execution id, proposal id, provider, prompt version, action type, risk level, team id, project id, target type/id/label, requester, decision actor, timestamps, terminal status, and redacted error fields.
- **D-22:** Prompt/tool-call audit should store metadata and summary counts, not full read context or raw tool payloads.
- **D-23:** Project AI history is visible from the project context as a read-only history surface. It should list recent AI executions/proposals/decisions and allow the user to inspect sanitized details.
- **D-24:** Visibility follows project authorization, with an extra privacy rule for personal TODO-related proposals: private TODO proposal/audit detail is visible only to the owner/requester unless the resulting TODO is intentionally linked into project-visible WBS context.
- **D-25:** Cancel decisions are audit events, not failures. Execution failures and validation rejections are audit events with redacted error details.

### Phase 12 Handoff
- **D-26:** Phase 11 should leave clear extension points for Phase 12 action types: issue create/update, personal TODO create/update, and WBS comment/work memo add.
- **D-27:** Phase 11 tests should prove destructive/delete/bulk/unknown executable actions cannot mutate data and that unsupported actions remain non-executable until a registered executor exists.

### the agent's Discretion
- The planner may choose exact DTO/entity names, endpoint paths, and component names, but must preserve the persisted proposal lifecycle, server-generated preview, individual approval controls, immutable terminal states, redaction-first audit policy, and Phase 12 executor handoff boundary.
- The planner may choose whether proposal cards are visually implemented inside `AiAnswerCard` or as a child component rendered by the drawer, as long as the first user-visible location is inside the originating AI answer.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Requirements
- `.planning/PROJECT.md` - v1.1 milestone goals, AI approval-gated write principle, provider abstraction, and AI safety constraints.
- `.planning/REQUIREMENTS.md` - Phase 11 requirements AI-ACT-01, AI-APP-01, AI-APP-02, AI-APP-03, AI-AUD-01, AI-AUD-02, and AI-AUD-03.
- `.planning/ROADMAP.md` - Phase 11 goal, Phase 9/10 dependency, success criteria, and Phase 12 boundary.
- `README.md` - project architecture, AI extension sequence, structured output rules, and forbidden direct AI execution patterns.

### Prior Phase Contracts
- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-CONTEXT.md` - provider execution boundary, action draft skeleton, local Codex security contract, metadata-only audit base, and redaction rules.
- `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-CONTEXT.md` - chat drawer behavior, read-only context policy, source chips, answer card structure, server-only read-tool authorization, and deferred write proposal boundary.
- `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-VERIFICATION.md` - verified Phase 10 grounding/privacy guarantees that Phase 11 must preserve.
- `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-REVIEW.md` - clean gap-closure code review and prior privacy blocker resolution.

### Existing AI Backend
- `src/main/java/com/smarterd/application/ai/provider/AiActionDraft.java` - current provider action draft skeleton to harden into persisted proposals.
- `src/main/java/com/smarterd/application/ai/validation/ActionDraftValidator.java` - current destructive/approval validation guard.
- `src/main/java/com/smarterd/application/ai/provider/AiProviderResult.java` - provider answer plus actions envelope.
- `src/main/java/com/smarterd/application/ai/AiProviderExecutionRunner.java` - shared execution runner used by chat and provider gateway.
- `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` - Phase 10 read-only chat orchestration; currently rejects provider actions.
- `src/main/java/com/smarterd/application/ai/AiExecutionAuditService.java` - existing metadata-only audit persistence service.
- `src/main/java/com/smarterd/domain/ai/AiExecutionAudit.java` - existing AI audit entity and current metadata fields.

### Existing PM Write Boundaries
- `src/main/java/com/smarterd/domain/pm/issue/service/ProjectIssueService.java` - existing issue create/update/status service boundary for Phase 12 executors.
- `src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` - existing personal TODO create/update/link service boundary and owner privacy policy.
- `src/main/java/com/smarterd/domain/pm/history/service/WorkItemHistoryService.java` - existing WBS comment/activity service boundary.
- `src/main/java/com/smarterd/api/project/ProjectIssueController.java` - issue API request/response shape to mirror in proposal payload labels.
- `src/main/java/com/smarterd/api/project/ProjectTodoController.java` - TODO API request/response shape to mirror in proposal payload labels.
- `src/main/java/com/smarterd/api/project/WbsController.java` - WBS comment/history API shape to mirror in proposal payload labels.

### Frontend AI Surface
- `client/src/types/ai-chat.ts` - current chat response/message types to extend with proposal cards.
- `client/src/types/ai-provider.ts` - current provider execution/action draft types.
- `client/src/components/ai/AiAnswerCard.tsx` - current answer card structure where proposal cards should first appear.
- `client/src/components/ai/AiChatDrawer.tsx` - drawer composition and message rendering integration point.
- `client/src/hooks/useAiChatExecution.ts` - chat send lifecycle and local abort behavior.
- `client/src/api/aiChatApi.ts` - typed chat API module pattern.
- `client/src/api/aiProviderApi.ts` - provider status/execution API module pattern.
- `client/src/stores/useAiChatStore.ts` - local conversation persistence; proposal state must avoid raw payload leakage.

### Codebase Architecture Maps
- `.planning/codebase/ARCHITECTURE.md` - API/Application/Domain layering, React Query/Zustand split, and error handling patterns.
- `.planning/codebase/INTEGRATIONS.md` - JWT auth, PostgreSQL/Flyway, i18n, environment, and E2E constraints.
- `.planning/codebase/CONVENTIONS.md` - Java record DTOs, transaction conventions, frontend API modules, i18n, JSDoc/Javadoc, and semantic styling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AiActionDraft` and `AiProviderResult` already carry provider action skeletons. Phase 11 can convert validated drafts into persisted proposal records instead of inventing a separate provider envelope.
- `ActionDraftValidator` already rejects non-approval and destructive-looking draft types. Phase 11 should harden this into typed action validation plus executable/unsupported separation.
- `AiExecutionAudit` and `AiExecutionAuditService` already persist execution metadata. Phase 11 can extend or supplement this with proposal and decision audit records.
- `AiChatExecutionService` already has a clear interception point where provider actions are currently rejected. Phase 11 can replace that rejection with proposal creation and response mapping.
- `AiAnswerCard`, `AiChatDrawer`, `AiSourceChips`, and `useAiChatStore` provide the existing chat presentation/persistence surface. Proposal cards should reuse this context without storing raw payloads in browser local storage.
- `ProjectIssueService`, `ProjectTodoService`, and `WorkItemHistoryService` are the service boundaries future action executors must call.

### Established Patterns
- Backend controllers remain thin; proposal approve/cancel/history controllers should delegate to application services.
- Backend writes use `@Transactional` service methods and existing authorization loaders before mutation.
- Frontend server state goes through typed API modules and React Query, while local drawer presentation state uses Zustand.
- User-facing errors use localized backend exceptions and frontend `getErrorMessage`/toast patterns.
- Existing AI provider execution uses status enums, immutable terminal states, output validation, and redacted provider errors; proposal lifecycle should mirror that rigor.

### Integration Points
- Add a backend proposal application service around provider actions, preview generation, approve/cancel transitions, and audit recording.
- Add persistent proposal/audit storage with Flyway migration; avoid storing raw model/prompt/context.
- Extend chat response DTO/types to include sanitized proposal card models.
- Add approve/cancel API functions and React Query mutations from the AI API module.
- Add project-scoped AI history read API and a read-only UI surface in the project context.
- Keep concrete issue/TODO/WBS comment executors pluggable so Phase 12 can register them without changing the approval shell.

</code_context>

<specifics>
## Specific Ideas

- Proposal cards should appear where the user is already reading the answer, not in a separate first-view queue.
- Users approve or cancel each proposal independently.
- The default card should read like a work-management review item: target, summary, changed fields, and risk.
- The UI should keep processed cards visible in the original chat message for traceability.
- Preview/diff must be server-generated and field-level for updates.
- Audit/history should be useful for project review without becoming raw prompt/model transcript storage.

</specifics>

<deferred>
## Deferred Ideas

- Concrete low-risk write action executors for issue create/update, personal TODO create/update, and WBS comment/work memo add belong to Phase 12.
- Delete, destructive, and bulk destructive actions remain excluded from v1.1 proposal/execution.
- Hosted provider implementations and API key/provider credential management remain future work outside Phase 11.
- Server-stored full chat transcript history remains out of Phase 11 unless needed only as sanitized proposal/audit metadata.

</deferred>

---

*Phase: 11-Approval Preview + Audit Execution Pipeline*
*Context gathered: 2026-06-04*
