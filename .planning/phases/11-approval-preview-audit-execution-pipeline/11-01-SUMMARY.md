---
phase: 11-approval-preview-audit-execution-pipeline
plan: 01
subsystem: ai-backend
tags: [ai, proposals, audit, approval, postgres, jpa]
requires:
  - phase: 09-ai-tool-gateway-provider-abstraction
    provides: provider action draft validation and metadata-only execution audit
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: read-only AI chat execution boundary
provides:
  - persisted AI action proposal lifecycle core
  - sanitized proposal payload and preview services
  - empty action executor registry for Phase 12 extension
affects: [phase-11, phase-12, ai-chat, ai-audit]
tech-stack:
  added: []
  patterns: [jpa-entity, flyway-migration, sanitized-dto-view, executor-registry]
key-files:
  created:
    - src/main/resources/db/migration/V20260604_01__phase11_ai_action_proposals.sql
    - src/main/java/com/smarterd/domain/ai/AiActionProposal.java
    - src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java
    - src/main/java/com/smarterd/application/ai/proposal/AiActionProposalSanitizer.java
    - src/main/java/com/smarterd/application/ai/proposal/AiActionExecutorRegistry.java
  modified:
    - src/test/java/com/smarterd/application/ai/ActionDraftValidatorTest.java
key-decisions:
  - "Proposal payload, preview, and result data are persisted as TEXT JSON strings using the existing project storage pattern."
  - "Phase 11 production executor registry remains empty; unsupported approvals become REJECTED without mutation."
patterns-established:
  - "Proposal lifecycle transitions are domain methods and only PENDING can transition."
  - "Browser/API-safe proposal data comes from AiActionProposalView, not raw payload maps."
requirements-completed: [AI-ACT-01, AI-APP-01, AI-APP-03, AI-AUD-01, AI-AUD-02]
duration: 16min
completed: 2026-06-04
---

# Phase 11 Plan 01 Summary

**Persisted, sanitized AI action proposal lifecycle with immutable terminal states and an empty executor boundary**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-04T04:50:00Z
- **Completed:** 2026-06-04T05:06:05Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added `ai_action_proposals` Flyway schema, JPA entity, repository, and six-state lifecycle enum.
- Added proposal sanitizer, validator, preview service, sanitized view, executor interface, and empty registry.
- Added lifecycle tests for creation, expiry, cancel/approve idempotency, unsupported rejection, and action draft destructive-type validation.

## Task Commits

1. **Tasks 1-3: Proposal persistence, sanitizer/preview, lifecycle service** - `82b7320` (`feat(11-01)`)

## Files Created/Modified

- `src/main/resources/db/migration/V20260604_01__phase11_ai_action_proposals.sql` - Proposal persistence table and indexes.
- `src/main/java/com/smarterd/domain/ai/AiActionProposal.java` - Server-owned proposal entity with immutable terminal transitions.
- `src/main/java/com/smarterd/domain/ai/AiActionProposalRepository.java` - Proposal lookup, expiry, and history queries.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java` - Create, approve, cancel, expire, and view mapping.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalSanitizer.java` - Whitelist and redaction of model-controlled payload values.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalValidator.java` - Draft and approval validation.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionPreviewService.java` - Typed server-generated preview data.
- `src/main/java/com/smarterd/application/ai/proposal/AiActionExecutorRegistry.java` - Empty registry boundary for Phase 12 executors.
- `src/test/java/com/smarterd/application/ai/proposal/AiActionProposalServiceTest.java` - Lifecycle and unsupported-action tests.
- `src/test/java/com/smarterd/application/ai/proposal/AiActionProposalSanitizerTest.java` - Raw-key redaction tests.

## Decisions Made

- Stored sanitized JSON in `TEXT` columns to match existing project patterns and avoid introducing new Hibernate JSON handling.
- Kept the Phase 11 registry empty in production, so future action types like `issue.create` can be displayed but approval rejects safely until Phase 12 registers executors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial `AiActionProposalServiceTest` setup instantiated the registry before stubbing mock executor action type. Fixed test setup ordering and reran targeted tests successfully.
- The proposal package raw-key scan reports expected matches in sanitizer guard strings and `draft.payload()` intake. Domain entity/migration scan is clean, and tests verify the keys are removed from sanitized output.

## Verification

- `./gradlew test --tests "*ActionDraftValidator*" --tests "*AiActionProposal*"` - passed.
- Domain raw-field scan for `AiActionProposal.java` and `V20260604_01__phase11_ai_action_proposals.sql` - clean.
- `git diff --check` - passed before commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 11-02 can now convert provider action drafts into persisted proposals and expose approve/cancel APIs using `AiActionProposalService`.

## Self-Check: PASSED

---
*Phase: 11-approval-preview-audit-execution-pipeline*
*Completed: 2026-06-04*
