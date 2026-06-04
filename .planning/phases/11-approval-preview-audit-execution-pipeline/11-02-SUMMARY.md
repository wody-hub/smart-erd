---
phase: 11-approval-preview-audit-execution-pipeline
plan: 02
subsystem: ai-backend
tags: [ai, proposals, approval, audit, api, chat]
requires:
  - phase: 11-approval-preview-audit-execution-pipeline
    plan: 01
    provides: persisted sanitized proposal lifecycle
provides:
  - chat responses with sanitized proposal previews
  - authenticated proposal refresh, approve, and cancel APIs
  - proposal decision audit metadata on execution audit rows
affects: [phase-11, phase-12, ai-chat, ai-audit, ai-api]
tech-stack:
  added: []
  patterns: [spring-mvc-controller, sanitized-dto-view, idempotent-decision-api, metadata-only-audit]
key-files:
  created:
    - src/main/java/com/smarterd/api/ai/AiActionProposalController.java
    - src/main/java/com/smarterd/api/ai/dto/AiActionProposalResponse.java
    - src/main/java/com/smarterd/api/ai/dto/AiActionProposalDecisionResponse.java
    - src/main/resources/db/migration/V20260604_02__phase11_ai_execution_audit_proposal_columns.sql
    - src/test/java/com/smarterd/api/ai/AiActionProposalControllerMvcTest.java
  modified:
    - src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java
    - src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java
    - src/main/java/com/smarterd/application/ai/AiExecutionAuditService.java
    - src/main/java/com/smarterd/domain/ai/AiExecutionAudit.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java
key-decisions:
  - "Provider action drafts now remain part of ANSWER responses as persisted sanitized proposals instead of read-only chat errors."
  - "Approve/cancel APIs accept only proposal id plus authenticated actor; browser-supplied preview or payload is never accepted."
  - "Decision responses expose proposal, decision, terminal, and message fields for frontend idempotency handling."
patterns-established:
  - "Proposal API DTOs are mapped from AiActionProposalView only."
  - "Proposal creation and terminal decisions are recorded as metadata-only audit rows."
requirements-completed: [AI-ACT-01, AI-APP-01, AI-APP-02, AI-APP-03, AI-AUD-01, AI-AUD-02]
duration: 32min
completed: 2026-06-04
---

# Phase 11 Plan 02 Summary

**Chat action drafts now become reviewable, authenticated, audit-safe proposal decisions**

## Performance

- **Duration:** 32 min
- **Started:** 2026-06-04T05:08:00Z
- **Completed:** 2026-06-04T05:40:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Replaced the `READ_ONLY_PROVIDER_ACTION_REJECTED` chat branch with `AiActionProposalService.createProposals(...)` integration.
- Added `proposals` to `AiChatView` and `AiChatResponse`, mapped only through sanitized `AiActionProposalResponse`.
- Added `/api/ai/proposals/{proposalId}`, `/approve`, and `/cancel` endpoints with JWT enforcement, idempotent terminal handling, and decision metadata.
- Extended `ai_execution_audits` with proposal metadata columns and added creation/decision audit writers.
- Added MVC/service/audit tests covering sanitized chat cards, authenticated endpoints, idempotent terminal responses, pending cancel audits, unsupported-action rejection audits, and error metadata caps.

## Task Commits

1. **Tasks 1-3: Chat proposal wiring, proposal APIs, and decision audit metadata** - `700cf3c` (`feat(11-02)`)

## Files Created/Modified

- `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` - Converts provider action drafts into persisted proposal views while preserving answer sections.
- `src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java` - Adds `proposals` to the chat API contract.
- `src/main/java/com/smarterd/api/ai/dto/AiActionProposalResponse.java` - Browser-safe proposal preview DTO.
- `src/main/java/com/smarterd/api/ai/dto/AiActionProposalDecisionResponse.java` - Decision response with `proposal`, `decision`, `terminal`, and `message`.
- `src/main/java/com/smarterd/api/ai/AiActionProposalController.java` - Proposal refresh, approve, and cancel endpoints.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java` - Adds audit hooks and proposal-specific not-found messaging.
- `src/main/java/com/smarterd/application/ai/AiExecutionAuditService.java` - Adds proposal creation and terminal decision audit writers.
- `src/main/java/com/smarterd/domain/ai/AiExecutionAudit.java` - Adds proposal metadata fields.
- `src/main/resources/db/migration/V20260604_02__phase11_ai_execution_audit_proposal_columns.sql` - Adds audit proposal columns and proposal id index.
- `src/test/java/com/smarterd/api/ai/AiActionProposalControllerMvcTest.java` - Endpoint authentication, decision, idempotency, and redaction tests.

## Decisions Made

- Kept unsupported action approval safe by returning `REJECTED` with redacted error metadata instead of introducing provisional executors.
- Used existing `ai_execution_audits` as the proposal decision audit sink rather than adding a separate event table in this plan.
- Returned message codes in decision responses so the frontend can localize consistently with existing error handling.

## Deviations from Plan

- The first implementation pass omitted `decision` and `terminal` from `AiActionProposalDecisionResponse`; this was corrected before summary and committed in `700cf3c`.

## Issues Encountered

- `./gradlew check` initially failed because `verifyFunctionDocs` requires Javadoc plus `@param` and `@return` tags for changed Java methods. Added required method docs and reran successfully.
- Raw-key scan reports expected matches only in `AiActionProposalSanitizer` deny-list predicates. API DTOs, audit entity, and controller code do not expose raw provider fields.

## Verification

- `./gradlew test --tests "*AiChatExecutionService*" --tests "*AiChatController*" --tests "*AiActionProposalController*" --tests "*AiExecutionAuditService*" --tests "*AiActionProposalService*" --tests "*AiChatDtoContract*"` - passed.
- `./gradlew test --tests "*AiActionProposalController*" --tests "*AiActionProposalService*"` - passed after acceptance test additions.
- `./gradlew check` - passed; `verifyFunctionDocs` passed.
- `git diff --check` - passed.
- Raw-field scan over AI API, proposal, audit domain, and audit service files - only sanitizer deny-list matches.

## User Setup Required

None - no new provider configuration or package install required.

## Next Phase Readiness

Plan 11-03 can consume the proposal API and audit metadata to add optimistic locking, race-condition handling, or additional server-side approval validation gaps. Plan 11-04 can render chat proposal cards using the new `proposals` field and decision endpoints.

## Self-Check: PASSED

---
*Phase: 11-approval-preview-audit-execution-pipeline*
*Completed: 2026-06-04*
