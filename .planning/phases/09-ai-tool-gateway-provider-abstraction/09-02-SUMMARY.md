---
phase: 09-ai-tool-gateway-provider-abstraction
plan: 02
subsystem: provider
tags: [codex, process-runner, sandbox, structured-output, env-filtering]
requires:
  - phase: 09-01
    provides: Backend AiProvider port, gateway lifecycle, output validator, and status API
provides:
  - Local Codex AiProvider implementation
  - Fixed argv process runner with temp cwd and workspace-write sandbox
  - Child environment allowlist
  - Safe Codex availability probe
  - JSON schema and Codex prompt resource
affects: [phase-09, phase-10]
tech-stack:
  added: []
  patterns:
    - ProcessLauncher seam for fake process tests
    - Local provider selected through Spring configuration
key-files:
  created:
    - src/main/java/com/smarterd/application/ai/provider/CodexProcessRunner.java
    - src/main/java/com/smarterd/application/ai/provider/LocalCodexProcessProvider.java
    - src/main/java/com/smarterd/application/ai/provider/CodexAvailabilityProbe.java
    - src/main/resources/ai/provider-output.schema.json
  modified:
    - src/main/java/com/smarterd/config/ai/AiProviderConfig.java
    - src/main/java/com/smarterd/application/ai/AiExecutionGateway.java
key-decisions:
  - "Local Codex is selected only when smart-erd.ai.provider=local-codex."
  - "Codex process execution uses List<String> argv, never shell command strings."
  - "Default tests use fake launchers and do not require a logged-in Codex CLI."
patterns-established:
  - "ProcessLauncher captures command/env/stdin/timeout so tests can verify process safety without launching Codex."
  - "LocalCodexProcessProvider maps runner failures to typed provider errors without exposing raw process details."
requirements-completed: [AI-RUN-01, AI-RUN-02, AI-RUN-03, AI-RUN-04, AI-SEC-01]
duration: 32min
completed: 2026-06-01
---

# Phase 09 Plan 02: Local Codex Provider Summary

**Local Codex CLI adapter behind the Spring provider port with fixed process argv, temp workspace, sandboxing, schema output, env filtering, and fake-runner tests**

## Performance

- **Duration:** 32 min
- **Started:** 2026-06-01T08:31:00Z
- **Completed:** 2026-06-01T09:03:00Z
- **Tasks:** 4
- **Files modified:** 17

## Accomplishments

- Added `LocalCodexProcessProvider` as the first real `AiProvider`.
- Added `CodexProcessRunner` that builds fixed argv: `codex exec --cd <temp> --sandbox workspace-write -c approval_policy="never" --output-schema <schema> -`.
- Added env allowlist that excludes backend/request/credential-like variables from the child process.
- Added `CodexAvailabilityProbe` using executable probing without `codex status` or path/stderr disclosure.
- Added opt-in local smoke test that is skipped by default.

## Task Commits

1. **Plan 09-02 implementation** - `8da0077` (feat)

**Plan metadata:** this summary commit

## Files Created/Modified

- `src/main/java/com/smarterd/application/ai/provider/CodexProcessRunner.java` - hardened process boundary.
- `src/main/java/com/smarterd/application/ai/provider/ProcessLauncher.java` - testable process launch seam.
- `src/main/java/com/smarterd/application/ai/provider/JavaProcessLauncher.java` - `ProcessBuilder` implementation with timeout/cancel handling.
- `src/main/java/com/smarterd/application/ai/provider/LocalCodexProcessProvider.java` - provider adapter and result mapping.
- `src/main/java/com/smarterd/application/ai/provider/CodexAvailabilityProbe.java` - safe runtime status probe.
- `src/main/resources/ai/provider-output.schema.json` - structured output schema for Codex.
- `src/test/java/com/smarterd/application/ai/provider/*` - fake-runner tests and opt-in smoke test.

## Decisions Made

- Status probing avoids `codex status` because it may require a TTY in backend contexts.
- The runner passes prompt content through stdin and never shell-interpolates prompt/context.
- The provider keeps backend validator authoritative even when Codex schema output is requested.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first RED run failed at test compilation because runner/provider/probe classes did not exist yet. This was expected for TDD setup.
- The availability test initially failed because the AVAILABLE message was null. It now returns a safe generic message.

## Verification

- `./gradlew test --tests "com.smarterd.application.ai.provider.*" --tests "com.smarterd.application.ai.AiExecutionGatewayCancellationTest"` — passed.
- `./gradlew test --tests "com.smarterd.application.ai.*" --tests "com.smarterd.api.ai.*"` — passed.
- `rg "/bin/sh|cmd /c|ProcessBuilder\\(String|inheritIO|environment\\(\\)\\.putAll" src/main/java/com/smarterd/application/ai` — no matches.
- `git diff --check` — passed.

## User Setup Required

None for default test runs. Local Codex smoke remains opt-in:

```bash
./gradlew test --tests "com.smarterd.application.ai.provider.LocalCodexSmokeTest" -Dsmart-erd.ai.codex.smoke.enabled=true
```

## Next Phase Readiness

Ready for Plan 09-03. Frontend can now call the existing provider status API and show local runtime availability without knowing about Codex or Electron IPC.

## Self-Check: PASSED

All Plan 09-02 success criteria are covered by implementation, fake-runner tests, opt-in smoke, and security inspection.

---
*Phase: 09-ai-tool-gateway-provider-abstraction*
*Completed: 2026-06-01*
