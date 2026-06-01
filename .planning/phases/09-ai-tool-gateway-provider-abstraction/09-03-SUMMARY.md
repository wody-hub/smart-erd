---
phase: 09-ai-tool-gateway-provider-abstraction
plan: 03
subsystem: frontend
tags: [react, react-query, ai-provider-status, contract]
requires:
  - phase: 09-01
    provides: Spring AI provider HTTP contract
  - phase: 09-02
    provides: Local Codex provider status implementation
provides:
  - Typed frontend AI provider API client
  - React Query provider status hook
  - Compact project workspace AI runtime status badge
  - Frontend contract and security verification closeout
affects: [phase-09, phase-10]
tech-stack:
  added: []
  patterns:
    - Shared React Query key namespace for AI provider runtime
    - Safe enum-to-label presentation helper
key-files:
  created:
    - client/src/types/ai-provider.ts
    - client/src/api/aiProviderApi.ts
    - client/src/hooks/useAiProviderStatus.ts
    - client/src/components/ai/AiProviderStatusBadge.tsx
  modified:
    - client/src/constants/query-keys.ts
    - client/src/pages/project/ProjectsPage.tsx
    - client/src/i18n/locales/ko/translation.json
    - client/src/i18n/locales/en/translation.json
key-decisions:
  - "The frontend calls only Spring HTTP endpoints through axiosInstance."
  - "The status badge renders localized enum labels only and does not render backend diagnostic detail."
  - "No Electron IPC or direct Codex runtime handling is introduced in Phase 9."
patterns-established:
  - "aiProviderApi is the reusable primitive for future chat/read/action phases."
  - "useAiProviderStatus owns polling and status refresh policy."
requirements-completed: [AI-RUN-01, AI-RUN-02, AI-RUN-03, AI-RUN-04, AI-SEC-01]
duration: 20min
completed: 2026-06-01
---

# Phase 09 Plan 03: Frontend Status Surface Summary

**Minimal React provider status surface and typed HTTP contract for the Spring AI gateway**

## Performance

- **Started:** 2026-06-01T17:00:00+09:00
- **Completed:** 2026-06-01T17:17:51+09:00
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added typed frontend contract for provider status, execute, execution lookup, and cancel.
- Added `queryKeys.aiProvider.status()` and `queryKeys.aiProvider.execution(executionId)`.
- Added `useAiProviderStatus` with stale/refetch policy for the minimal runtime surface.
- Added `AiProviderStatusBadge` to the project workspace hero utility area.
- Added Korean and English labels for all provider availability states plus loading/error states.
- Added focused unit tests for availability presentation and query key stability.

## Deviations from Plan

None. The implementation stayed within the Phase 9 boundary and did not add chat UI, read tools, approval UI, write execution, or provider configuration UI.

## Issues Encountered

- The RED unit test initially failed because the AI provider frontend module and query keys did not exist yet.
- The first frontend build failed because the dynamic i18n key was typed as a generic string. The label key is now a literal union.

## Verification

- `cd client && npm run test:unit` — passed, 367 tests.
- `cd client && npm run build` — passed.
- `./gradlew test` — passed.
- `rg "codex|electron|ipc" client/src/api client/src/hooks client/src/components/ai` — no matches.
- `rg "stdout|stderr|prompt|context|token|cookie|password|executablePath|authPath" client/src/types/ai-provider.ts client/src/api/aiProviderApi.ts client/src/components/ai` — no matches.

## User Setup Required

None for default verification. Local Codex happy-path smoke remains opt-in because it depends on the developer machine having Codex CLI installed and logged in.

## Next Phase Readiness

Ready for Phase 10. The app now has the reusable HTTP client and status hook needed for the chatbot shell and read-only context tools.

## Self-Check: PASSED

All Plan 09-03 success criteria are covered by implementation, build, unit tests, full backend tests, and security inspection.

---
*Phase: 09-ai-tool-gateway-provider-abstraction*
*Completed: 2026-06-01*
