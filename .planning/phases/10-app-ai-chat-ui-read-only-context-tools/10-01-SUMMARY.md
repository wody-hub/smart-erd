---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 01
subsystem: testing
tags: [spring, react, playwright, ai-chat, wave-0]
requires:
  - phase: 09-ai-tool-gateway-provider-abstraction
    provides: Spring AI provider gateway, output validation, and frontend provider status patterns
provides:
  - Backend Wave 0 chat/read test contract
  - Frontend Wave 0 chat unit test contract
  - AI drawer Playwright smoke contract
  - Compile-safe Phase 10 production skeletons for later implementation plans
affects: [phase-10, phase-11, phase-12]
tech-stack:
  added: []
  patterns:
    - Skeleton-first RED contract for high-risk AI chat behavior
    - Node unit tests importing compiled .js source modules
    - Deterministic Playwright route mocking for AI provider/chat endpoints
key-files:
  created:
    - src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java
    - src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java
    - src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java
    - src/main/java/com/smarterd/api/ai/AiChatController.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatSourceChipResponse.java
    - src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java
    - src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java
    - src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java
    - src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java
    - client/src/types/ai-chat.ts
    - client/src/stores/useAiChatStore.ts
    - client/src/hooks/useAiRouteContext.ts
    - client/src/components/ai/AiAnswerCard.tsx
    - client/src/components/ai/AiSourceChips.tsx
    - client/test/unit/ai-chat-store.test.ts
    - client/test/unit/ai-chat-context.test.ts
    - client/test/unit/ai-chat-response-cards.test.ts
    - client/e2e/smoke/ai-chat-drawer.spec.ts
  modified: []
key-decisions:
  - "Wave 0 commits intentionally keep production chat/read behavior skeletal so later plans own implementation."
  - "The E2E smoke has a credential skip guard but retains the authenticated helper path for configured local smoke runs."
  - "No packages or registry assets were added for the Wave 0 contract."
patterns-established:
  - "Backend chat tests use exact 10-W0 IDs in DisplayName values and compile against narrow service/DTO skeletons."
  - "Frontend chat tests use node:test plus React element inspection instead of DOM testing packages."
  - "The drawer smoke mocks /api/ai/provider/status and /api/ai/chat before submit."
requirements-completed: [AI-CHAT-01, AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04]
duration: 9min
completed: 2026-06-02
---

# Phase 10 Plan 01: Wave 0 Validation Contract Summary

**Backend, frontend, and Playwright RED contracts for read-only AI chat scope, privacy, source-backed answers, and global drawer behavior**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-02T06:09:38Z
- **Completed:** 2026-06-02T06:18:41Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added compile-safe backend skeletons for chat scope resolution, read context, execution orchestration, `/api/ai/chat`, and response DTOs.
- Added backend Wave 0 tests for `10-W0-01`, `10-W0-02`, `10-W0-03`, and `10-W0-08`.
- Added frontend skeletons for chat types, local store helpers, route context resolution, source chips, and answer cards.
- Added frontend unit tests for `10-W0-04`, `10-W0-05`, and `10-W0-06`.
- Added deterministic AI drawer Playwright smoke for `10-W0-07`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backend Wave 0 chat/read tests** - `d81d939` (test)
2. **Task 2: Create frontend Wave 0 unit tests** - `826f0df` (test)
3. **Task 3: Create drawer Playwright smoke** - `16690b5` (test)

**Plan metadata:** this summary commit

## Files Created/Modified

- `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` - Skeleton scope resolver contract.
- `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java` - Skeleton summary-first read context contract.
- `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` - Skeleton read-only chat assembler contract.
- `src/main/java/com/smarterd/api/ai/AiChatController.java` and DTOs - Skeleton `/api/ai/chat` HTTP boundary.
- `src/test/java/com/smarterd/application/ai/chat/*Test.java` and `src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java` - Backend Wave 0 RED tests.
- `client/src/types/ai-chat.ts`, `client/src/stores/useAiChatStore.ts`, `client/src/hooks/useAiRouteContext.ts`, `client/src/components/ai/*` - Frontend compile-safe chat skeletons.
- `client/test/unit/ai-chat-*.test.ts` - Frontend Wave 0 unit tests.
- `client/e2e/smoke/ai-chat-drawer.spec.ts` - AI drawer smoke with deterministic provider/chat route mocks.

## Decisions Made

- Kept production skeletons intentionally conservative: they expose only contracts and return safe empty/confirmation values.
- Used no new dependencies; frontend response-card tests inspect React element trees directly.
- Added a credential skip guard to the Playwright smoke so unconfigured environments do not block Wave 0 verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed frontend unit test helper compilation**
- **Found during:** Task 2
- **Issue:** The response-card unit helper initially used JSX in a `.ts` file and then hit a callable-type narrowing issue.
- **Fix:** Replaced JSX with direct component calls and cast function components in the helper renderer.
- **Files modified:** `client/test/unit/ai-chat-response-cards.test.ts`
- **Verification:** `cd client && npm run test:unit` reaches behavioral RED failures, not TypeScript setup failures.
- **Committed in:** `826f0df`

**2. [Rule 3 - Blocking] Added Playwright credential skip guard**
- **Found during:** Task 3
- **Issue:** The smoke command failed before exercising the spec because `SMART_ERD_E2E_LOGIN` was not configured.
- **Fix:** Added a top-level skip guard for missing `SMART_ERD_E2E_LOGIN` or `SMART_ERD_E2E_PASSWORD`; configured runs still use the existing authenticated login helper.
- **Files modified:** `client/e2e/smoke/ai-chat-drawer.spec.ts`
- **Verification:** `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts` exits 0 with one skip in this environment.
- **Committed in:** `16690b5`

---

**Total deviations:** 2 auto-fixed (2 Rule 3)
**Impact on plan:** Both fixes keep the Wave 0 contract executable without adding scope or dependencies.

## Issues Encountered

- Backend verification is intentionally RED: `./gradlew test --tests "*AiChatContext*" --tests "*AiReadContext*" --tests "*AiChatExecutionService*" --tests "*AiChatController*"` compiles and runs 16 tests with 8 behavioral assertion failures.
- Frontend verification is intentionally RED: `cd client && npm run test:unit` compiles and runs the suite with 382 tests, 377 passing and 5 Wave 0 behavior failures.
- The drawer smoke is skipped locally because E2E credentials are not configured; the spec remains ready for configured local app runs.

## Verification

- `./gradlew test --tests "*AiChatContext*" --tests "*AiReadContext*" --tests "*AiChatExecutionService*" --tests "*AiChatController*"` - expected RED, compile succeeded, 16 tests ran, 8 behavioral failures.
- `cd client && npm run test:unit` - expected RED, TypeScript compile succeeded, 382 tests ran, 377 passed, 5 Wave 0 behavior failures.
- `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts` - passed with 1 skipped due missing E2E credentials.
- Wave 0 file existence scan - passed for all 8 validation files.
- `rg -n "10-W0-0[1-8]" ...` - passed; all Wave 0 IDs are present in test names/display names.
- `rg "npm install|gradle .*implementation" .planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-01-PLAN.md` - no package install work introduced.
- `git diff --check` - passed.

## Known Stubs

- `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java:12` - returns confirmation for every non-empty scope; Plan 10-02 owns real scope resolution.
- `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java:14` - returns empty facts/source chips; Plan 10-02 owns summary-first read tools.
- `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java:20` - does not call read tools or provider for resolved context; Plan 10-03 owns orchestration.
- `client/src/hooks/useAiRouteContext.ts:10` - route context defaults to weak unless manual override exists; Plan 10-04 owns route derivation.
- `client/src/stores/useAiChatStore.ts:50` - persistence does not yet cap to 50 or strip unsafe fields; Plan 10-04 owns safe local persistence.

## User Setup Required

None for Wave 0 unit/backend verification. To run the drawer smoke instead of skipping it, set `SMART_ERD_E2E_LOGIN` and `SMART_ERD_E2E_PASSWORD` and run against a local app/backend.

## Next Phase Readiness

Ready for Plan 10-02 and Plan 10-04. The missing behavior is now encoded as RED tests instead of missing classes/modules.

## Self-Check: PASSED

- All 20 created task files exist.
- Task commits `d81d939`, `826f0df`, and `16690b5` exist in git history.
- No tracked file deletions were introduced.
- Generated Playwright artifacts were removed; unrelated root PNG files remain untracked and untouched.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-02*
