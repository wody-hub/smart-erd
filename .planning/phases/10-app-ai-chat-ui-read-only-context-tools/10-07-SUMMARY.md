---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 07
subsystem: ui
tags: [react, ai-chat, drawer, authenticated-shell, playwright, tdd]

requires:
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: Authenticated `/api/ai/chat` backend endpoint with read-only structured responses
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: AI chat store, route context, execution hook, context bar, composer, and answer cards
provides:
  - Authenticated global right-side AI chat drawer
  - Shared header AI chat trigger plus shell fallback opener
  - Protected route shell mounting across every App protected route
  - Deterministic drawer smoke assertion for send-time source chips after route changes
affects: [phase-10, ai-chat-ui, authenticated-app-shell, phase-11-action-proposals]

tech-stack:
  added: []
  patterns:
    - Protected routes share a single `protectedAppElement` wrapper for AI drawer hosting
    - Drawer composes existing typed chat execution hook and presentation components
    - Provider status API is lazy-loaded from its hook for pure Node unit imports

key-files:
  created:
    - client/src/components/ai/AiChatDrawer.tsx
    - client/src/components/ai/AiChatTrigger.tsx
    - client/src/components/ai/AuthenticatedAiChatShell.tsx
    - client/test/unit/ai-chat-drawer.test.ts
  modified:
    - client/src/App.tsx
    - client/src/components/layout/Header.tsx
    - client/src/hooks/useAiProviderStatus.ts
    - client/e2e/smoke/ai-chat-drawer.spec.ts

key-decisions:
  - "AuthenticatedAiChatShell relies on ProtectedRoute as the authentication gate and does not import the auth store directly."
  - "The shell fallback opener uses a distinct accessible name so the shared header trigger remains the deterministic `AI에게 질문` opener in Playwright."
  - "The drawer sends only through `useAiChatExecution` and uses `stopWaiting` for local HTTP aborts."

patterns-established:
  - "AI drawer host, open state, transcript, selected context, and confirmation candidates remain global store-backed across route changes."
  - "Protected route coverage is asserted by a unit source-audit list matching App route patterns."
  - "Drawer smoke uses deterministic provider/chat mocks and asserts source chips are not rewritten by later route changes."

requirements-completed: [AI-CHAT-01, AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04]

duration: 9min
completed: 2026-06-02
---

# Phase 10 Plan 07: Global AI Chat Drawer Integration Summary

**Authenticated global AI chat drawer mounted across protected routes with persistent transcript, manual context selection, and deterministic read-only smoke coverage**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-02T07:42:59Z
- **Completed:** 2026-06-02T07:51:08Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Built `AiChatDrawer`, `AiChatTrigger`, and `AuthenticatedAiChatShell` so authenticated users get a right-side AI drawer, header trigger, and route-independent fallback opener.
- Mounted the shell on every protected route in `client/src/App.tsx` and added the shared `AiChatTrigger` to `Header` without replacing provider status, theme, language, settings, logout, or page `rightSlot` behavior.
- Composed the drawer from existing Phase 10 boundaries: `useAiChatStore`, `useAiRouteContext`, `useAiChatContextOptions` through `AiChatContextBar`, `AiAnswerCard`, `AiChatComposer`, and `useAiChatExecution`.
- Updated the Playwright smoke to assert source chips remain tied to the send-time response context after a later route change.

## Task Commits

Each task was committed atomically. Task 1 followed RED/GREEN TDD:

1. **Task 1 RED: drawer integration contracts** - `01b0a8b` (test)
2. **Task 1 GREEN: global drawer shell and trigger** - `925c8d4` (feat)
3. **Task 2: mount drawer in authenticated app shell** - `7b3f25f` (feat)
4. **Task 3: final Phase 10 verification smoke update** - `c6b31a7` (test)

**Plan metadata:** this summary commit

## Files Created/Modified

- `client/src/components/ai/AiChatDrawer.tsx` - Right-side Radix dialog drawer with provider status, fixed context bar, transcript, composer, close, and local-only new conversation confirmation.
- `client/src/components/ai/AiChatTrigger.tsx` - Localized authenticated header trigger for opening the drawer.
- `client/src/components/ai/AuthenticatedAiChatShell.tsx` - Protected-route shell host with drawer and fallback opener plus protected route coverage helpers.
- `client/src/App.tsx` - Wraps every protected route with `AuthenticatedAiChatShell` inside `ProtectedRoute`.
- `client/src/components/layout/Header.tsx` - Adds `AiChatTrigger` to the authenticated shared utility rail while preserving existing utilities and `rightSlot`.
- `client/src/hooks/useAiProviderStatus.ts` - Lazy-loads the provider status API to keep pure unit imports out of the browser axios/i18n graph.
- `client/test/unit/ai-chat-drawer.test.ts` - Covers trigger presentation, drawer view model, confirmation candidates, and protected route shell coverage.
- `client/e2e/smoke/ai-chat-drawer.spec.ts` - Adds post-answer route-change source-chip stability assertion.

## Decisions Made

- Kept the authentication gate at `ProtectedRoute` instead of duplicating token checks inside `AuthenticatedAiChatShell`; public routes do not mount the shell.
- Used a shell-level fallback button with a distinct accessible name to avoid Playwright strict-mode ambiguity with the header trigger named `AI에게 질문`.
- Kept stop behavior inside `useAiChatExecution.stopWaiting`; no provider cancellation, Codex, Electron IPC, or read-tool calls were added to the drawer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy-loaded provider status API**
- **Found during:** Task 1 (unit GREEN)
- **Issue:** Importing the drawer in pure Node unit tests pulled `axiosInstance` and app i18n JSON through `useAiProviderStatus`, causing Node JSON import-attribute failure.
- **Fix:** Changed `useAiProviderStatus` to dynamically import `fetchAiProviderStatus` inside the React Query loader.
- **Files modified:** `client/src/hooks/useAiProviderStatus.ts`
- **Verification:** `cd client && npm run test:unit`
- **Committed in:** `925c8d4`

**2. [Rule 3 - Blocking] Removed unnecessary shell auth-store import**
- **Found during:** Task 1 (unit GREEN)
- **Issue:** Importing `AuthenticatedAiChatShell` in Node tests loaded `useAuthStore`, which reads `localStorage` at module initialization.
- **Fix:** Let `ProtectedRoute` remain the auth gate and removed the shell's direct auth-store dependency.
- **Files modified:** `client/src/components/ai/AuthenticatedAiChatShell.tsx`
- **Verification:** `cd client && npm run test:unit`
- **Committed in:** `925c8d4`

**3. [Rule 1 - Build] Typed dynamic aiChat translation keys**
- **Found during:** Task 2 build verification
- **Issue:** Typed i18next overloads rejected dynamic view-model key strings in `AiChatDrawer` and `AiChatTrigger`.
- **Fix:** Added small `translateAiChatKey` helpers for dynamic `aiChat.*` keys.
- **Files modified:** `client/src/components/ai/AiChatDrawer.tsx`, `client/src/components/ai/AiChatTrigger.tsx`
- **Verification:** `cd client && npm run build`
- **Committed in:** `7b3f25f`

---

**Total deviations:** 3 auto-fixed (1 build bug, 2 blocking import issues)
**Impact on plan:** All fixes were required for test/build correctness. No package installs, write/action UI, provider direct calls, or scope expansion were introduced.

## Issues Encountered

- `cd client && npm run build` still reports the existing circular chunk warning between `feature-dsl` and `feature-code-sync`; build completed successfully.
- `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts` skipped because `SMART_ERD_E2E_LOGIN` and `SMART_ERD_E2E_PASSWORD` are not set in this environment. The smoke itself uses deterministic `/api/ai/provider/status` and `/api/ai/chat` route mocks.

## Verification

- `cd client && npm run test:unit` - passed, 398 tests.
- `cd client && npm run build` - passed.
- `./gradlew test && cd client && npm run build && npm run test:unit` - passed.
- `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts` - skipped due missing `SMART_ERD_E2E_LOGIN` and `SMART_ERD_E2E_PASSWORD`.
- `rg "codex|electron|ipc" client/src/api client/src/hooks client/src/components/ai` - no matches.
- `rg "accessToken|refreshToken|cookie|password|rawPrompt|rawContext|rawProviderOutput|SMART_ERD|SPRING_" client/src/types/ai-chat.ts client/src/stores/useAiChatStore.ts client/src/components/ai` - no matches.
- `rg "cancelAiExecution|cancelRunning" client/src/components/ai client/src/hooks/useAiChatExecution.ts` - no matches.
- `rg "codex|electron|ipc|proposal|approval|diff|delete" client/src/components/ai client/src/App.tsx client/src/components/layout/Header.tsx` - no matches.
- `rg "bg-gray|text-blue|bg-emerald|#[0-9A-Fa-f]" client/src/components/ai` - no matches.
- `rg "AiChat" client/src/pages` - no matches.
- `git diff -- client/package.json package-lock.json client/package-lock.json package.json` - empty.
- `git diff --check` - passed.

## Known Stubs

None. Stub scan found only a normal default parameter in `client/test/unit/ai-chat-drawer.test.ts`, not a UI placeholder or unwired data source.

## Threat Flags

None. The authenticated app shell/drawer and browser-local transcript surfaces are the planned 10-07 trust boundaries and are covered by the threat register.

## User Setup Required

No package or service setup required. To run the drawer Playwright smoke locally, set `SMART_ERD_E2E_LOGIN` and `SMART_ERD_E2E_PASSWORD` and run against the existing test frontend/backend profile.

## Next Phase Readiness

Phase 10 is ready for Phase 11 action proposal planning. The app now has the global read-only chat drawer mounted everywhere after login, with responses and confirmation candidates flowing through the existing backend chat API and frontend execution hook.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-07-SUMMARY.md`.
- Created files exist: `AiChatDrawer.tsx`, `AiChatTrigger.tsx`, `AuthenticatedAiChatShell.tsx`, and `ai-chat-drawer.test.ts`.
- Task commits `01b0a8b`, `925c8d4`, `7b3f25f`, and `c6b31a7` exist in git history.
- `git diff --check` passed.
- No tracked file deletions were introduced.
- Unrelated root PNG files remain untracked and untouched.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-02*
