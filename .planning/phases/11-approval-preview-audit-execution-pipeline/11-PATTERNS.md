# Phase 11: Pattern Map

**Mapped:** 2026-06-04
**Status:** Ready for planning

## Purpose

Phase 11 extends the existing AI provider, chat, audit, and project workspace surfaces. The implementation should reuse established Smart-ERD boundaries instead of creating a parallel AI write path.

## Backend Analogs

| Phase 11 Target | Closest Existing Analog | Pattern to Reuse |
|-----------------|-------------------------|------------------|
| Proposal persistence | `AiExecutionAudit`, `AiExecutionAuditRepository`, `V20260601_01__phase9_ai_execution_audit.sql` | JPA entity in `domain/ai`, metadata-first columns, repository by stable external id, Flyway migration with project/requester indexes |
| Proposal lifecycle service | `AiProviderExecutionRunner`, `AiExecutionRegistry`, `AiExecutionAuditService` | Application service owns transaction, status transition, audit side effects, and redacted error mapping |
| Draft validation | `ActionDraftValidator`, `ProviderOutputValidator`, `AiActionDraft` | Validate provider action envelope before any browser or executor exposure; reject destructive type strings early |
| Chat integration | `AiChatExecutionService`, `AiChatResponse.from(...)`, `AiChatController` | Controller remains thin, `AiChatExecutionService` assembles response sections, DTOs map application views to records |
| Project authorization | `ProjectContextLoader`, `ProjectIssueService`, `ProjectTodoService`, `WorkItemHistoryService` | Re-run authorization in application service before proposal display, approval, history, and future executor calls |
| Project history API | `ProjectIssueController`, `ProjectTodoController`, `WbsController` | Project-scoped route carries `teamId` and `projectId`; service enforces membership and resource visibility |

## Frontend Analogs

| Phase 11 Target | Closest Existing Analog | Pattern to Reuse |
|-----------------|-------------------------|------------------|
| Chat response types | `client/src/types/ai-chat.ts` | Extend typed response shape; keep response fields sanitized and renderable |
| Chat API | `client/src/api/aiChatApi.ts`, `client/src/api/aiProviderApi.ts` | Isolated API module with injectable test client for Node unit tests |
| Drawer state | `client/src/stores/useAiChatStore.ts` | Zustand local persistence with explicit sanitizer functions and per-login storage key |
| Chat rendering | `AiAnswerCard`, `AiSourceChips`, shadcn-compatible primitives | Add proposal panels inside answer card without nested cards; keep existing facts/interpretation/source chip sections |
| Chat execution hook | `useAiChatExecution` | Normalize server response before appending assistant message; add in-place proposal update path |
| Project hub tab | `DiagramsPage`, `project-workspace-tab-order.ts`, `queryKeys` | Add an `aiHistory` workspace tab, include it in persisted tab order normalization, and use React Query for server history |

## Required Data Flow

1. Provider returns `AiActionDraft` values in `AiProviderResult.actions`.
2. `ProviderOutputValidator` and `ActionDraftValidator` keep destructive drafts out before proposal creation.
3. `AiChatExecutionService` sends safe actions to `AiActionProposalService` instead of returning `READ_ONLY_PROVIDER_ACTION_REJECTED`.
4. `AiActionProposalService` persists sanitized proposal rows linked to `executionId`, `teamId`, `projectId`, requester, action type, target, preview, and expiry.
5. `AiChatResponse` returns `proposals: AiActionProposalResponse[]` with no raw payload, prompt, provider context, stdout, stderr, token, cookie, env, or local path data.
6. Frontend renders each proposal inside the originating `AiAnswerCard`, stores only sanitized card data, and calls approve/cancel endpoints by `proposalId`.
7. Approve/cancel endpoints reload the persisted proposal, revalidate auth/status/target/action/executor support, transition idempotently, and write redacted audit metadata.
8. Project AI history lists sanitized execution/proposal/decision records through a project-scoped route.

## File Creation Targets

Backend proposal core:

- `src/main/java/com/smarterd/domain/ai/AiActionProposal.java`
- `src/main/java/com/smarterd/domain/ai/AiActionProposalRepository.java`
- `src/main/java/com/smarterd/domain/ai/AiActionProposalStatus.java`
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalService.java`
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalSanitizer.java`
- `src/main/java/com/smarterd/application/ai/proposal/AiActionProposalValidator.java`
- `src/main/java/com/smarterd/application/ai/proposal/AiActionPreviewService.java`
- `src/main/java/com/smarterd/application/ai/proposal/AiActionExecutor.java`
- `src/main/java/com/smarterd/application/ai/proposal/AiActionExecutorRegistry.java`
- `src/main/resources/db/migration/V20260604_01__phase11_ai_action_proposals.sql`

Frontend proposal core:

- `client/src/types/ai-chat.ts`
- `client/src/api/aiChatApi.ts`
- `client/src/hooks/useAiChatExecution.ts`
- `client/src/stores/useAiChatStore.ts`
- `client/src/components/ai/AiProposalPanel.tsx`
- `client/src/components/ai/AiProposalPreview.tsx`
- `client/src/components/ai/AiProposalStatusBadge.tsx`
- `client/src/components/ai/AiAnswerCard.tsx`

Project history:

- `src/main/java/com/smarterd/application/ai/history/AiProjectHistoryService.java`
- `src/main/java/com/smarterd/api/ai/AiProjectHistoryController.java`
- `client/src/api/aiHistoryApi.ts`
- `client/src/components/project/ProjectAiHistoryTab.tsx`
- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/lib/project-workspace-tab-order.ts`

## Implementation Constraints

- No Phase 11 plan may register production issue/TODO/WBS write executors. The executor registry exists so Phase 12 can register them.
- Unsupported but non-destructive future action types may be displayed as non-executable proposals. Approve must reject safely and audit the rejection.
- All proposal and history DTOs are whitelisted views. Browser state never becomes source of truth for approval, preview, or execution.
- Personal TODO proposal/history detail follows the extra privacy rule from D-24.
