---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 04
subsystem: frontend-ai-chat-state
tags: [react, zustand, ai-chat, local-storage, route-context]
requires:
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: Wave 0 frontend chat store and route-context unit contracts
provides:
  - Typed frontend AI chat request, response, message, context, source-chip, and confirmation candidate models
  - Login-scoped local AI chat persistence with presentation-only serialization and 50-message retention
  - Auth login/logout hydration and clearing for active chat namespaces
  - Route-derived AI context hints for strong project, team-only, and weak screens
affects: [phase-10, phase-11, phase-12, ai-chat-drawer, ai-chat-api]
tech-stack:
  added: []
  patterns:
    - Explicit login-scoped storage helpers instead of static Zustand persist keys
    - Whitelist serialization for browser-local AI chat presentation state
    - Pure route context resolver with React Router wrapper for client hints
key-files:
  created: []
  modified:
    - client/src/types/ai-chat.ts
    - client/src/stores/useAiChatStore.ts
    - client/src/hooks/useAiRouteContext.ts
    - client/src/constants/storage.ts
    - client/src/stores/useAuthStore.ts
    - client/test/unit/ai-chat-store.test.ts
key-decisions:
  - "AI chat local persistence is keyed by the authenticated login id and serialized manually through whitelisted fields."
  - "Route context remains a client-side hint; backend scope validation stays authoritative."
  - "useAiRouteContext accepts optional loaded labels instead of fetching project or team bundles itself."
patterns-established:
  - "createAiChatStorageKey/load/save/clear helpers own browser-local chat namespace operations."
  - "serializeAiChatConversation rebuilds saved messages, responses, context, source chips, and confirmation candidates from safe presentation fields only."
  - "deriveAiRouteContext is pure and testable; useAiRouteContext only reads React Router location/params plus optional labels."
requirements-completed: [AI-CHAT-01, AI-CHAT-02]
duration: 11min
completed: 2026-06-02
---

# Phase 10 Plan 04: AI Chat Store and Route Context Summary

**Login-scoped AI chat presentation persistence plus route-derived context hints for the global drawer**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-02T06:35:40Z
- **Completed:** 2026-06-02T06:46:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added frontend AI chat models for request/response, sectioned answers, source chips, context snapshots, confirmation candidates, and persisted messages.
- Implemented a Zustand-backed chat store with explicit per-login storage helpers, 50-message retention, safe serialization, new-conversation reset, login hydration, and logout clearing.
- Added `STORAGE_KEYS.AI_CHAT_CONVERSATION_PREFIX` and wired `useAuthStore.login/logout` to switch or clear chat namespaces.
- Implemented `deriveAiRouteContext`, `requiresExplicitAiScope`, `createAiSendContextSnapshot`, and `useAiRouteContext` for strong project, team-only, and weak route contexts.
- Strengthened the store unit contract to assert serialized payload shape, confirmation candidates, namespace isolation, logout clearing, and user-switch hydration.

## Task Commits

Each task was committed atomically. Task 1 includes a RED test commit and GREEN implementation commit:

1. **Task 1: Define frontend chat types and safe store** - `0ca5524` (test), `7f64520` (feat)
2. **Task 2: Implement route-context hint hook** - `786ce47` (feat)

**Plan metadata:** this summary commit

## Files Created/Modified

- `client/src/types/ai-chat.ts` - Defines chat request/response, context, source chip, answer section, confirmation candidate, error, message, and snapshot models.
- `client/src/stores/useAiChatStore.ts` - Implements explicit storage-key helpers, safe serialization/deserialization, login hydration, logout clearing, and Zustand drawer state actions.
- `client/src/hooks/useAiRouteContext.ts` - Derives route context hints and send-time snapshots without calling provider/runtime APIs.
- `client/src/constants/storage.ts` - Adds the AI chat conversation storage prefix.
- `client/src/stores/useAuthStore.ts` - Hydrates chat state on login and clears the active chat namespace on logout.
- `client/test/unit/ai-chat-store.test.ts` - Extends Wave 0 store tests for serialization, confirmation candidates, user switch, and logout behavior.

## Decisions Made

- Used manual serialization helpers instead of Zustand `persist` so the storage key is derived from the current login id on each operation.
- Kept `loadAiChatConversation` returning messages for the existing Wave 0 contract while `deserializeAiChatConversation` and `hydrateAiChatConversationForLogin` restore full drawer presentation state.
- Kept route context label resolution as optional input to `useAiRouteContext`; the hook does not fetch read-tool data or become an authorization source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed route-context hook label loading**
- **Found during:** Task 2 (Implement route-context hint hook)
- **Issue:** Importing `fetchTeam`/`fetchProject` into the hook pulled additional API/platform modules into the frontend unit compile path and exposed an unrelated `ImportMeta.env` typing issue in `platform.ts`.
- **Fix:** Kept `useAiRouteContext` route-derived and accepted optional `teamName`/`projectName` labels from already-loaded page/app-shell context instead of fetching labels inside the hook.
- **Files modified:** `client/src/hooks/useAiRouteContext.ts`
- **Verification:** `cd client && npm run test:unit`; runtime/API grep for the hook returned no matches.
- **Committed in:** `786ce47`

---

**Total deviations:** 1 auto-fixed (1 Rule 3)
**Impact on plan:** The hook still provides typed context hints and keeps backend authorization authoritative. It avoids broadening the hook into a data-fetching surface before the drawer integration plan wires app-shell context.

## Issues Encountered

- The full frontend unit suite initially failed only on Wave 0 chat store/context tests. After implementation, all 384 frontend unit tests passed.
- A transient compile issue appeared when the hook imported API modules; this was resolved by keeping the hook route-derived and label-optional.

## Verification

- `cd client && npm run test:unit` - passed, 384 tests.
- `rg "codex|electron|ipc|axiosInstance" client/src/stores/useAiChatStore.ts client/src/hooks/useAiRouteContext.ts` - no matches.
- `rg "accessToken|refreshToken|cookie|password|rawPrompt|rawContext|rawProviderOutput|SMART_ERD|SPRING_|toolPayload|env" client/src/stores/useAiChatStore.ts client/src/types/ai-chat.ts` - no matches.
- `git diff --check` - passed.

## Known Stubs

None. Stub-pattern scan only found legitimate `TODO` read-tool labels and null/default guards in serialization code.

## Threat Flags

None. The new browser-local storage surface is the planned mitigation surface for T-10-04-01 through T-10-04-03 and stores whitelisted presentation state only.

## User Setup Required

None.

## Next Phase Readiness

Ready for the frontend API/execution and drawer component plans. The drawer can now rely on typed local state, per-login persistence, confirmation candidate models, and route-derived context hints without storing raw provider/read-tool data.

## Self-Check: PASSED

- Created summary path exists: `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-04-SUMMARY.md`.
- Modified task files exist: chat types, chat store, route-context hook, storage constants, auth store, and store unit tests.
- Task commits `0ca5524`, `7f64520`, and `786ce47` exist in git history.
- `cd client && npm run test:unit` passed after all task commits.
- No tracked file deletions were introduced.
- Unrelated root PNG files remain untracked and untouched.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-02*
