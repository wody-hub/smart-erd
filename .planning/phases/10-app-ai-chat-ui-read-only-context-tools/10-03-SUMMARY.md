---
phase: 10-app-ai-chat-ui-read-only-context-tools
plan: 03
subsystem: backend-ai-chat-api
tags: [spring, ai-chat, provider-runner, read-only, tdd]
requires:
  - phase: 10-app-ai-chat-ui-read-only-context-tools
    provides: Server-side chat scope resolver and summary-first read context
  - phase: 09-ai-tool-gateway-provider-abstraction
    provides: Provider abstraction, execution registry, output validation, and audit lifecycle
provides:
  - Authenticated synchronous /api/ai/chat backend endpoint
  - Read-only chat DTO contract with context, source chips, confirmation data, and execution metadata
  - Shared AiProviderExecutionRunner for Phase 9 gateway and Phase 10 chat execution
  - Chat assembler that maps provider answer only to interpretation and rejects provider actions
affects: [phase-10, phase-11, phase-12, ai-chat, ai-provider-gateway]
tech-stack:
  added: []
  patterns:
    - Shared provider runner behind gateway/chat orchestration
    - Server-owned chat response assembly from read facts and source chips
    - TDD red/green commits per backend chat task
key-files:
  created:
    - src/main/java/com/smarterd/application/ai/AiProviderExecutionRunner.java
    - src/test/java/com/smarterd/api/ai/dto/AiChatDtoContractTest.java
    - src/test/java/com/smarterd/application/ai/AiProviderExecutionRunnerTest.java
  modified:
    - src/main/java/com/smarterd/api/ai/AiChatController.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java
    - src/main/java/com/smarterd/api/ai/dto/AiChatSourceChipResponse.java
    - src/main/java/com/smarterd/application/ai/AiExecutionGateway.java
    - src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java
    - src/main/resources/i18n/messages.properties
    - src/main/resources/i18n/messages_ko.properties
    - src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java
    - src/test/java/com/smarterd/application/ai/AiExecutionGatewayCancellationTest.java
    - src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java
    - src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java
key-decisions:
  - "AiExecutionGateway remains the Phase 9 single-project facade; provider lifecycle moved to AiProviderExecutionRunner."
  - "AiChatExecutionService calls the runner directly after resolver/read-context success instead of calling AiExecutionGateway.execute."
  - "Provider action drafts in chat produce READ_ONLY_PROVIDER_ACTION_REJECTED and are not exposed in API response DTOs."
patterns-established:
  - "Chat API request accepts frontend message/context shape while keeping userMessage as a compatibility alias."
  - "Chat response context, source chips, confirmed facts, conclusion, and confirmation data are server assembled."
  - "Provider result answer is only interpretation; read facts remain the source of conclusion and confirmed facts."
requirements-completed: [AI-CHAT-01, AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04]
duration: 11min
completed: 2026-06-02
---

# Phase 10 Plan 03: Backend Chat API Orchestration Summary

**Synchronous read-only AI chat endpoint backed by server read facts, source chips, and a shared provider execution runner**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-02T06:51:13Z
- **Completed:** 2026-06-02T07:02:28Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added the backend chat DTO contract for `message`, context hints, selected resource, execution metadata, confirmation candidates, context summary, source chips, facts, interpretation, and safe error state.
- Extracted `AiProviderExecutionRunner` from the Phase 9 gateway lifecycle while preserving provider status, validation, registry, audit, and cancel behavior.
- Implemented `AiChatExecutionService` ordering: resolve scope, assemble read context, call the provider runner, and shape the read-only response.
- Rejected non-empty provider action drafts with `READ_ONLY_PROVIDER_ACTION_REJECTED` and no action/proposal/diff/approval fields in chat DTOs.
- Moved `AiChatController` to the chat-specific `/api/ai/chat` mapping while keeping it thin around JWT subject, validated request DTO, and service response mapping.

## Task Commits

Each task was committed atomically. TDD tasks include RED and GREEN commits:

1. **Task 1: Define chat HTTP DTO contract** - `77261e9` (test), `aebf36c` (feat)
2. **Task 2: Implement chat execution orchestration** - `6ce00ac` (test), `7bdfa3f` (feat)
3. **Task 3: Add authenticated chat controller** - `364d19e` (test), `e1ef777` (feat)

**Plan metadata:** this summary commit

## Files Created/Modified

- `src/main/java/com/smarterd/api/ai/AiChatController.java` - Thin authenticated `/api/ai/chat` HTTP boundary.
- `src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java` - Frontend-compatible chat request contract with validation keys and context mapping.
- `src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java` - Read-only structured answer, confirmation, context, source-chip, and error response contract.
- `src/main/java/com/smarterd/api/ai/dto/AiChatSourceChipResponse.java` - Source chip DTO with optional team/project metadata.
- `src/main/java/com/smarterd/application/ai/AiProviderExecutionRunner.java` - Shared provider execution lifecycle, validation, registry, audit, and cancel runner.
- `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java` - Phase 9 facade refactored to authorize and delegate to the runner.
- `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` - Chat orchestration and server-side read-only response assembly.
- `src/main/resources/i18n/messages.properties` and `messages_ko.properties` - Chat message validation keys.
- Backend tests under `src/test/java/com/smarterd/api/ai` and `src/test/java/com/smarterd/application/ai` - DTO, controller, runner, gateway, and chat service coverage.

## Decisions Made

- Kept `AiExecutionGateway.execute` as the single-project Phase 9 facade instead of using it for multi-project chat reads.
- Used a runner command carrying representative team/project IDs plus sanitized provider context so chat can pass read summaries without rebuilding gateway context.
- Preserved `userMessage` as a JSON alias for compatibility, while the primary chat request field is `message`.
- Returned safe structured chat errors for provider failures and provider action drafts instead of throwing HTTP errors after provider execution.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The package-install threat check matched the threat-register row in `10-03-PLAN.md`; no package-manager install command or dependency change was introduced.
- The stub scan found only null/default guards and existing TODO domain labels, not unfinished placeholders.

## Verification

- `./gradlew test --tests "*AiChatController*" --tests "*AiReadContext*"` - passed.
- `./gradlew test --tests "*AiChatExecutionService*" --tests "com.smarterd.application.ai.*" --tests "com.smarterd.api.ai.*"` - passed.
- `./gradlew test --tests "*AiChatController*"` - passed.
- `./gradlew test --tests "*AiChatController*" --tests "*AiReadContext*" --tests "*AiChatExecutionService*" --tests "com.smarterd.application.ai.*"` - passed during Task 2.
- `rg "codex|ProcessBuilder|electron|ipc" src/main/java/com/smarterd/api/ai src/main/java/com/smarterd/application/ai/chat` - no matches.
- `rg "cancelRunning|startChat|chatStatus|/api/ai/chat/.*/cancel" src/main/java/com/smarterd/api/ai client/src/api client/src/hooks` - no matches.
- `rg "proposal|approval|diff|delete|executeWrite" src/main/java/com/smarterd/api/ai/dto/AiChat*.java` - no matches.
- `git diff -- src/main/java/com/smarterd/application/ai/provider/AiProviderResult.java src/main/resources/ai/provider-output.schema.json` - empty.
- `git diff --check` - passed.

## Known Stubs

None.

## Threat Flags

None. The new `/api/ai/chat` endpoint, provider result handling, and runner boundary are the planned surfaces covered by the 10-03 threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 10-05 frontend API execution wiring. The backend chat endpoint now returns confirmation or read-only answer/error responses without exposing provider action proposals or requiring frontend/provider runtime coupling.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/10-app-ai-chat-ui-read-only-context-tools/10-03-SUMMARY.md`.
- Created files exist: `AiProviderExecutionRunner.java`, `AiChatDtoContractTest.java`, and `AiProviderExecutionRunnerTest.java`.
- Task commits `77261e9`, `aebf36c`, `6ce00ac`, `7bdfa3f`, `364d19e`, and `e1ef777` exist in git history.
- No tracked file deletions were introduced.
- `git diff --check` passed.
- Unrelated root PNG files remain untracked and untouched.

---
*Phase: 10-app-ai-chat-ui-read-only-context-tools*
*Completed: 2026-06-02*
