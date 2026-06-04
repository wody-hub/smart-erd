---
phase: 11-approval-preview-audit-execution-pipeline
status: clean
depth: standard
files_reviewed: 39
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
files_reviewed_list:
  - client/src/api/aiChatApi.ts
  - client/src/api/aiHistoryApi.ts
  - client/src/components/ai/AiAnswerCard.tsx
  - client/src/components/ai/AiProposalPanel.tsx
  - client/src/components/ai/AiProposalPreview.tsx
  - client/src/components/ai/AiProposalStatusBadge.tsx
  - client/src/components/project/ProjectAiHistoryTab.tsx
  - client/src/constants/query-keys.ts
  - client/src/hooks/useAiChatExecution.ts
  - client/src/lib/project-workspace-tab-order.ts
  - client/src/pages/diagram/DiagramsPage.tsx
  - client/src/stores/useAiChatStore.ts
  - client/src/types/ai-chat.ts
  - client/src/types/ai-history.ts
  - client/test/unit/ai-history-api.test.ts
  - client/test/unit/project-ai-history-tab.test.ts
  - src/main/java/com/smarterd/api/ai/AiActionProposalController.java
  - src/main/java/com/smarterd/api/ai/AiProjectHistoryController.java
  - src/main/java/com/smarterd/api/ai/dto/AiActionProposalDecisionResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiActionProposalResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiProjectHistoryResponse.java
  - src/main/java/com/smarterd/application/ai/AiExecutionAuditService.java
  - src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java
  - src/main/java/com/smarterd/application/ai/history/AiProjectHistoryService.java
  - src/main/java/com/smarterd/application/ai/proposal/AiActionExecutorRegistry.java
  - src/main/java/com/smarterd/application/ai/proposal/AiActionProposalSanitizer.java
  - src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java
  - src/main/java/com/smarterd/domain/ai/AiActionProposal.java
  - src/main/java/com/smarterd/domain/ai/AiActionProposalRepository.java
  - src/main/java/com/smarterd/domain/ai/AiExecutionAudit.java
  - src/main/java/com/smarterd/domain/ai/AiExecutionAuditRepository.java
  - src/main/resources/db/migration/V20260604_01__phase11_ai_action_proposals.sql
  - src/main/resources/db/migration/V20260604_02__phase11_ai_execution_audit_proposal_columns.sql
  - src/test/java/com/smarterd/api/ai/AiActionProposalControllerMvcTest.java
  - src/test/java/com/smarterd/api/ai/AiProjectHistoryControllerMvcTest.java
  - src/test/java/com/smarterd/application/ai/ActionDraftValidatorTest.java
  - src/test/java/com/smarterd/application/ai/history/AiProjectHistoryServiceTest.java
  - src/test/java/com/smarterd/application/ai/proposal/AiActionProposalServiceTest.java
created: 2026-06-04T05:53:01Z
---

# Phase 11 Code Review

Final result: clean after review-time remediation.

## Scope

Reviewed the Phase 11 source and test files derived from `11-01` through `11-05` summaries, excluding planning artifacts. The review focused on approval authorization, immutable proposal state transitions, raw provider data exposure, audit redaction, no-executor safety, and read-only history UI behavior.

## Resolved During Review

### CR-11-01: Proposal endpoints did not revalidate project access before returning or transitioning proposals

- **Severity:** Critical
- **Files:** `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java`, `src/test/java/com/smarterd/application/ai/proposal/AiActionProposalServiceTest.java`
- **Risk:** Any authenticated user who obtained a proposal id could refresh, approve, or cancel a proposal without proving membership in the proposal's team/project.
- **Fix:** `AiActionProposalService` now injects `ProjectContextLoader` and calls `projectContextLoader.load(loginId, proposal.teamId, proposal.projectId, false)` from the shared `loadAccessible(...)` path used by get, approve, and cancel.
- **Verification:** Added service tests for project access revalidation and access-denied behavior before transition/audit. Committed as `dfb7800` (`fix(11-02): revalidate proposal project access`).

## Remaining Findings

None.

## Verification Evidence

- `./gradlew test --tests "*AiActionProposal*" --tests "*AiChat*" --tests "*AiProjectHistory*" --tests "*Ai*Audit*"` - passed after remediation.
- `./gradlew check` - passed after remediation.
- `rg "rawPrompt|rawContext|rawProviderOutput|stdout|stderr|accessToken|refreshToken|cookie|password|SMART_ERD_|SPRING_|env" ... --glob '!**/AiActionProposalSanitizer.java'` - no exposure-path matches after remediation.
- `git diff --check` - passed.
