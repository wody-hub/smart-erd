---
phase: 09-ai-tool-gateway-provider-abstraction
status: complete
completed: 2026-06-01
requirements_completed: [AI-RUN-01, AI-RUN-02, AI-RUN-03, AI-RUN-04, AI-SEC-01]
plans_completed: [09-01, 09-02, 09-03]
---

# Phase 09 Summary: AI Tool Gateway + Provider Abstraction

Phase 9 delivered the AI execution gateway foundation for Smart-ERD. The app can now call an AI provider through a Spring backend boundary, report Local Codex runtime availability, run a hardened local Codex process adapter when configured, validate structured provider output, track execution lifecycle state, cancel running executions, and persist metadata-only audit records.

## Delivered Scope

- Spring HTTP provider contract:
  - `GET /api/ai/provider/status`
  - `POST /api/ai/provider/execute`
  - `GET /api/ai/provider/executions/{executionId}`
  - `POST /api/ai/provider/executions/{executionId}/cancel`
- Backend provider abstraction with default `NoopAiProvider` and configurable `LocalCodexProcessProvider`.
- Hardened Local Codex process runner:
  - fixed argv, no shell command string
  - fresh temporary working directory
  - `workspace-write` sandbox
  - non-interactive execution
  - structured output schema
  - child environment allowlist
  - timeout and cancellation handling
- Provider output and action draft validation:
  - known execution states
  - non-destructive action risk levels
  - destructive/delete/bulk destructive proposal rejection
  - fail-closed invalid output handling
- Execution status registry with retention and terminal-state immutability.
- Metadata-only AI execution audit table/service.
- Frontend typed `aiProviderApi`, query keys, provider status hook, and project workspace status badge.

## Explicitly Out of Scope

Phase 9 did not implement:

- app chat UI
- rich read tools for project overview, WBS, milestones, issues, TODOs, or work history
- approval preview UI
- write tool execution
- hosted providers or API-key provider management
- provider configuration UI
- one-shot correction retry for invalid provider JSON output
- Electron IPC for provider execution

## Verification

See `VERIFICATION.md` for the full verification log. Summary:

- Backend targeted AI tests passed.
- Full backend `./gradlew test` passed.
- Frontend `npm run test:unit` passed with 367 tests.
- Frontend `npm run build` passed.
- Process-runner and frontend coupling/security grep checks passed for Phase 9 files.
- Local Codex happy-path smoke is present but skipped by default because it depends on local CLI login state.

## Follow-Up Items

- Phase 10 should build the app AI chatbot shell and read-only context tools on top of `aiProviderApi`.
- Phase 11 should add approval preview, proposal lifecycle, and full audit execution pipeline.
- Phase 12 should add the low-risk write tools after approval.
- A follow-up phase should add one-shot correction retry for invalid provider JSON output, as deferred in `09-CONTEXT.md`.
- Future provider work may add OpenAI API, Ollama, Claude, or SaaS-compatible adapters behind the same provider port.

## Handoff Notes

- Web and Electron should both continue using Spring HTTP for Phase 9 provider calls; Electron IPC is intentionally absent.
- The frontend status badge displays only localized status enum labels. It must not render provider diagnostic detail.
- Any later write execution must call existing application/domain services and keep delete/destructive actions rejected.
- The backend local Codex adapter assumes the backend OS user is already logged into Codex.
