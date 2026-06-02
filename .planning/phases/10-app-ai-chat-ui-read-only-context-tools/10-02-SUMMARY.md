---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 02
subsystem: backend-ai-read-context
tags: [spring, ai-chat, authorization, read-tools, i18n]
requires:
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: Wave 0 backend chat/read test contract and compile-safe skeletons
provides:
  - Server-authoritative AI chat scope resolver
  - Summary-first AI read context assembly with hard caps
  - Source-chip factory based on backend read result counts
  - Aggregate-only member TODO summary read path
affects: [phase-10, phase-11, phase-12, ai-chat, pm-read-tools]
tech-stack:
  added: []
  patterns:
    - Optional no-arg constructors for isolated unit contracts plus injected Spring constructors for production services
    - Confirmation-safe scope resolution before read/provider execution
    - Aggregate-only member TODO summaries by owner/status/count
key-files:
  created:
    - src/main/java/com/smarterd/application/ai/chat/AiSourceChipFactory.java
  modified:
    - src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java
    - src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java
    - src/main/java/com/smarterd/domain/common/message/MessageCode.java
    - src/main/resources/i18n/messages.properties
    - src/main/resources/i18n/messages_ko.properties
    - src/main/java/com/smarterd/domain/pm/todo/repository/ProjectTodoRepository.java
    - src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java
    - src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java
    - src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java
key-decisions:
  - "Project-name auto-resolution is limited to exact/manual IDs and normalized exact names; contains and fuzzy candidates remain confirmation-only."
  - "Member-wide TODO reads use a named aggregate-only path and expose owner/status/count only."
  - "Read context caps are enforced before provider-context serialization and exposed in cap metadata."
patterns-established:
  - "Backend source chips are derived from ToolReadResult counts, not provider prose."
  - "AI chat confirmation/denial reasons are localized through MessageCode and i18n bundles."
  - "Read tool selection recognizes Korean/SI PM synonyms without sending every project bundle by default."
requirements-completed: [AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04]
duration: 11min
completed: 2026-06-02
---

# Phase 10 Plan 02: Backend AI Read Context Summary

**Server-owned AI chat scope validation plus summary-first project read context with source-backed chips and aggregate-only member TODOs**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-02T06:21:24Z
- **Completed:** 2026-06-02T06:32:27Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Implemented `AiChatContextResolver` with weak-scope confirmation, normalized exact project matching, fuzzy/contains confirmation candidates, route conflict detection, all-team denial, and current-team fanout cap.
- Implemented `AiReadContextService` with deterministic read-tool selection, hard cap metadata, sanitized provider context serialization, and source chips from backend read result counts.
- Added `AiSourceChipFactory` and an aggregate-only `ProjectTodoService.getMemberTodoSummaries` path for member TODO status/count summaries.
- Added localized AI chat scope message codes in English and Korean bundles.

## Task Commits

Each task was committed atomically. TDD tasks include RED and GREEN commits:

1. **Task 1: Implement server-side chat scope resolver** - `5344e54` (test), `ec61773` (feat)
2. **Task 2: Implement summary-first read context and source chips** - `2b0c196` (test), `9637886` (feat)

**Plan metadata:** this summary commit

## Files Created/Modified

- `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` - Resolves route/manual/named/team project scopes and returns localized confirmation or denial reasons before reads.
- `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java` - Selects read tools, calls existing PM services, enforces caps, and produces sanitized facts/context/source metadata.
- `src/main/java/com/smarterd/application/ai/chat/AiSourceChipFactory.java` - Builds source chips from actual backend read result counts.
- `src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` and repository - Adds authorized member TODO aggregate summaries by owner/status/count only.
- `src/main/java/com/smarterd/domain/common/message/MessageCode.java`, `messages.properties`, `messages_ko.properties` - Add localized AI chat scope messages.
- `src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java` - Covers exact-only name resolution, fuzzy/contains confirmation, all-team denial, and fanout cap.
- `src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java` - Covers Korean tool selection, caps, aggregate-only TODO summaries, sanitized context, and source-chip counts.

## Decisions Made

- Kept the resolver provider-free and read-tool-free; it only authorizes or returns confirmation/denial metadata.
- Added a TODO aggregate service method instead of exposing private TODO detail through AI read context.
- Preserved no-arg constructors for isolated Wave 0 tests while production Spring uses injected constructors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved resolver confirmation candidate order**
- **Found during:** Task 1
- **Issue:** Candidate sorting changed the confirmation list order and broke the deterministic test contract.
- **Fix:** Preserved the accessible-project input/service order for confirmation candidates.
- **Files modified:** `AiChatContextResolver.java`
- **Verification:** `./gradlew test --tests "*AiChatContext*"`
- **Committed in:** `ec61773`

**2. [Rule 2 - Missing Critical] Added aggregate-only member TODO read path**
- **Found during:** Task 2
- **Issue:** Existing TODO reads were owner-detail reads only, so member-wide TODO status could not be implemented without either leaking details or adding an aggregate path.
- **Fix:** Added `ProjectTodoService.getMemberTodoSummaries` and repository support; output is owner user id/display name, status, and count only.
- **Files modified:** `ProjectTodoService.java`, `ProjectTodoRepository.java`
- **Verification:** `./gradlew test --tests "*AiReadContext*"`
- **Committed in:** `9637886`

**3. [Rule 1 - Bug] Tightened Korean tool-selection keyword behavior**
- **Found during:** Task 2
- **Issue:** The generic Korean word `요약` selected overview even when the question explicitly named WBS/milestone/issue/TODO/history tools.
- **Fix:** Removed `요약` as a standalone overview trigger.
- **Files modified:** `AiReadContextService.java`
- **Verification:** `./gradlew test --tests "*AiReadContext*"`
- **Committed in:** `9637886`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2)
**Impact on plan:** All fixes were required for deterministic behavior or privacy-preserving correctness; no new external packages or architecture changes were introduced.

## Issues Encountered

- `AiSourceChipFactory` did not exist from Wave 0, so Task 2 created it as planned.
- The original Wave 0 tests were intentionally RED; this plan added stricter RED tests and then made all targeted backend read-context tests pass.

## Verification

- `./gradlew test --tests "*AiChatContext*"` - passed.
- `./gradlew test --tests "*AiReadContext*"` - passed.
- `./gradlew test --tests "*AiChatContext*" --tests "*AiReadContext*"` - passed.
- `rg "aiProvider|Codex|ProcessBuilder|electron|ipc" src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` - no matches.
- `rg "accessToken|refreshToken|cookie|password|rawPrompt|rawContext|rawProviderOutput|SPRING_|SMART_ERD_" src/main/java/com/smarterd/application/ai/chat` - no matches.
- `git diff --check` - passed.
- Package-install threat check - no package install work introduced.

## Known Stubs

None blocking. The no-arg constructors retain synthetic fallback facts for isolated unit tests only; Spring production wiring uses injected services.

## Threat Flags

None. The new member TODO aggregate surface is the planned mitigation for T-10-02-03 and exposes no TODO titles, descriptions, documents, target dates, or raw item details.

## User Setup Required

None.

## Next Phase Readiness

Ready for Plan 10-03 chat execution assembly. The backend can now resolve safe scope, collect capped read context, and pass source-backed facts to the chat assembler/provider boundary.

## Self-Check: PASSED

- Created file exists: `src/main/java/com/smarterd/application/ai/chat/AiSourceChipFactory.java`.
- Modified task files exist: resolver, read context service, TODO aggregate service/repository, message bundles, and tests.
- Task commits `5344e54`, `ec61773`, `2b0c196`, and `9637886` exist in git history.
- No tracked file deletions were introduced.
- Unrelated root PNG files remain untracked and untouched.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-02*
