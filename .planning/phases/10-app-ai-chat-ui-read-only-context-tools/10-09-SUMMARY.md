---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 09
subsystem: ai-chat
tags: [ai, authorization, todo, privacy]
requires:
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: AI read context services and scope resolver
provides:
  - Member TODO aggregate privacy restricted to WBS-linked project-visible TODOs
  - Required ProjectContextLoader-backed AI chat single-project authorization
affects: [phase-10, phase-11, ai-read-tools]
tech-stack:
  added: []
  patterns: [linked-only aggregate query, fail-closed scope authorization]
key-files:
  created:
    - .planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-09-SUMMARY.md
  modified:
    - src/main/java/com/smarterd/domain/pm/todo/repository/ProjectTodoRepository.java
    - src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java
    - src/test/java/com/smarterd/domain/pm/todo/service/ProjectTodoServiceTest.java
    - src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java
    - src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java
key-decisions:
  - "Member TODO summaries count only TODO rows linked to WBS items so private unlinked personal TODOs stay out of team aggregates."
  - "AiChatContextResolver requires ProjectContextLoader and returns DENIED when the loader rejects single-project scope."
patterns-established:
  - "Aggregate TODO read paths use repository methods that encode project-visible linkage in the query name."
  - "AI chat resolver tests provide explicit ProjectContextLoader authorization fixtures."
requirements-completed:
  - AI-READ-03
  - AI-READ-04
duration: 1 min
completed: 2026-06-04
---

# Phase 10 Plan 09: TODO Aggregate Privacy And Scope Authorization Summary

**Member TODO summaries now exclude unlinked private TODOs and single-project chat scope must pass ProjectContextLoader authorization**

## Performance

- **Duration:** 1 min
- **Started:** 2026-06-04T01:44:29Z
- **Completed:** 2026-06-04T01:45:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a linked-WBS-only TODO repository method for member aggregate inputs.
- Updated `ProjectTodoService.getMemberTodoSummaries` to count only project-visible linked TODO rows.
- Removed the no-arg/null-loader resolver path and forced single-project AI chat scope through `ProjectContextLoader.load`.
- Added regression tests for unlinked TODO exclusion and loader denial behavior.

## Task Commits

1. **Task 1: Restrict member TODO aggregate inputs to project-visible linked TODOs** - `a2f52ae`
2. **Task 2: Require ProjectContextLoader for AI chat scope authorization** - `e519935`

## Files Created/Modified

- `src/main/java/com/smarterd/domain/pm/todo/repository/ProjectTodoRepository.java` - Adds linked-WBS-only aggregate query method.
- `src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` - Uses the linked-only repository path for member summaries.
- `src/test/java/com/smarterd/domain/pm/todo/service/ProjectTodoServiceTest.java` - Verifies unlinked private TODOs are excluded.
- `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` - Requires `ProjectContextLoader` and removes the authorization fallback.
- `src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java` - Verifies loader-backed resolve and DENIED failure path.

## Decisions Made

- Kept member TODO output aggregate-only: owner id, owner display name, status, and count.
- Preserved DENIED response semantics for authorization failure instead of throwing from AI chat resolution.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

None.

## Verification

- `./gradlew test --tests "com.smarterd.domain.pm.todo.service.ProjectTodoServiceTest" --tests "com.smarterd.application.ai.chat.AiChatContextResolverTest" --tests "com.smarterd.application.ai.chat.AiReadContextServiceTest"` - PASS
- `! rg "findByProjectOrderByCreatedAtDescIdDesc\\(project\\)" src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` - PASS
- `! rg "public AiChatContextResolver\\(\\)" src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java` - PASS
- `! rg "projectContextLoader == null|@Nullable ProjectContextLoader" src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` - PASS
- `! rg "MemberTodoSummaryResult\\([^\\n]*(title|description|targetDate|sharedDocuments)" src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` - PASS

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `10-10-PLAN.md`.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-04*
