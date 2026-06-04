---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 10
subsystem: ai-chat
tags: [ai, frontend, dto, multi-project]
requires:
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: Chat API DTO, frontend execution hook, and authenticated chat shell
provides:
  - Chat DTO without unsupported selectedResource scope
  - Team-context frontend sends mapped to backend MULTI_PROJECT fanout contract
affects: [phase-10, phase-11, ai-chat-ui]
tech-stack:
  added: []
  patterns: [typed chat DTO, centralized request builder, multi-project scope mapping]
key-files:
  created:
    - .planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-10-SUMMARY.md
  modified:
    - src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java
    - src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java
    - src/test/java/com/smarterd/api/ai/dto/AiChatDtoContractTest.java
    - client/src/types/ai-chat.ts
    - client/src/hooks/useAiChatExecution.ts
    - client/test/unit/ai-chat-execution.test.ts
key-decisions:
  - "Keep selectedResource available only in the Phase 9 provider execute DTO, not in Phase 10 chat."
  - "Map team and multi-project frontend contexts to backend scopeMode MULTI_PROJECT with null projectId."
patterns-established:
  - "Chat request scope mapping is centralized in buildAiChatRequest."
  - "Backend DTO contract tests prove currentTeamMode and multiProjectQuestion for team fanout."
requirements-completed:
  - AI-CHAT-02
  - AI-READ-04
duration: 1 min
completed: 2026-06-04
---

# Phase 10 Plan 10: Chat Contract And Team Scope Summary

**Team-context chat sends now use the backend MULTI_PROJECT contract and Phase 10 chat no longer exposes selectedResource**

## Performance

- **Duration:** 1 min
- **Started:** 2026-06-04T01:47:36Z
- **Completed:** 2026-06-04T01:48:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Removed `selectedResource` from the backend chat request DTO and chat command.
- Removed `selectedResource` from the frontend `AiChatRequest` type while leaving provider execute selected-resource support intact.
- Added frontend scope resolution so team and multi-project contexts send `scopeMode: MULTI_PROJECT` with `projectId: null`.
- Added backend and frontend contract tests for team fanout scope mapping.

## Task Commits

1. **Task 1: Remove unsupported selectedResource from the Phase 10 chat contract** - `6a2732e`
2. **Task 2: Map team context sends to backend MULTI_PROJECT contract** - `25553a5`

## Files Created/Modified

- `src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java` - Removes chat selected-resource field and maps command without it.
- `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` - Removes selected resource from chat command.
- `src/test/java/com/smarterd/api/ai/dto/AiChatDtoContractTest.java` - Verifies no selectedResource JSON field and MULTI_PROJECT command flags.
- `client/src/types/ai-chat.ts` - Removes selected-resource type from chat request.
- `client/src/hooks/useAiChatExecution.ts` - Maps team/multi-project context to `MULTI_PROJECT`.
- `client/test/unit/ai-chat-execution.test.ts` - Verifies team context can send and builds the correct request.

## Decisions Made

- Removed the unsupported chat selected-resource scope rather than accepting an unused field.
- Kept team fanout explicit with `MULTI_PROJECT` so backend resolver follows the current-team multi-project branch.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

- Initial backend DTO test used a string for `teamId`; fixed to `1L` and reran backend tests successfully.

## Verification

- `./gradlew test --tests "com.smarterd.api.ai.dto.AiChatDtoContractTest" --tests "com.smarterd.api.ai.AiChatControllerMvcTest" --tests "com.smarterd.application.ai.chat.AiChatContextResolverTest" --tests "com.smarterd.application.ai.chat.AiChatExecutionServiceTest"` - PASS
- `cd client && npm run test:unit` - PASS
- `! rg "selectedResource" src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java client/src/types/ai-chat.ts client/src/hooks/useAiChatExecution.ts` - PASS
- `rg "MULTI_PROJECT" client/src/hooks/useAiChatExecution.ts client/test/unit/ai-chat-execution.test.ts src/test/java/com/smarterd/api/ai/dto/AiChatDtoContractTest.java` - PASS
- `! rg "axiosInstance|codex|electron|ipc|fetchWbs|fetchIssues|fetchTodos|fetchMilestones|readContext|providerContext" client/src/hooks/useAiChatExecution.ts client/test/unit/ai-chat-execution.test.ts` - PASS

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 10 gap closure implementation is ready for verification.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-04*
