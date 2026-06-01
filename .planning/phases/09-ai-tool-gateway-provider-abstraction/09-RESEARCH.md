# Phase 9: AI Tool Gateway + Provider Abstraction - Research

**Date:** 2026-06-01
**Status:** Research complete

## Research Question

What needs to be true to plan Phase 9 well, given the existing Smart-ERD Spring/React architecture and the hardened AI gateway context?

## Inputs Read

- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-CONTEXT.md`
- `docs/superpowers/specs/2026-05-29-phase-9-ai-execution-gateway-architecture-design.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `CLAUDE.md`
- `DESIGN.md`
- existing Spring controllers/services/tests under `src/main/java/com/smarterd` and `src/test/java/com/smarterd`
- existing frontend API/query/i18n/workspace files under `client/src`
- local `codex exec --help`

## Current Architecture Findings

### Backend Layering

- HTTP controllers live in `src/main/java/com/smarterd/api/**` and are intentionally thin.
- Existing PM APIs are nested under `/api/teams/{teamId}/projects/{projectId}/...`, but Phase 9 context explicitly locks provider endpoints under `/api/ai/provider/**`.
- PM services use `ProjectContextLoader` to enforce team membership, project ownership, and editable/read-only checks. AI execution should reuse this loader for preflight, not duplicate auth logic in controllers.
- Application-layer use cases already exist under `src/main/java/com/smarterd/application/**`, so `application/ai` is an acceptable home for gateway orchestration while keeping Codex details out of PM domain services.
- `GlobalExceptionHandler` maps localized domain exceptions to simple `{ "error": "..." }` HTTP bodies. Provider execution failures should not bypass that path for request/auth/validation failures, but provider runtime failure can be represented in the AI response DTO.

### Backend Persistence

- Flyway migrations live under `src/main/resources/db/migration`.
- Existing auditable entities extend `BaseAuditEntity` or `BaseTimeEntity`. Phase 9 audit rows should not store prompt/context/response payloads, so a slim `ai_execution_audits` table is enough.
- Existing migration style uses `CREATE TABLE IF NOT EXISTS`, `TIMESTAMPTZ`, identity primary keys, FK references, and explicit indexes.

### Backend Testing

- MVC tests commonly use `MockMvcBuilders.standaloneSetup`, custom `@AuthenticationPrincipal Jwt` argument resolver, and a `StaticMessageSource` when exception handling is part of the assertion.
- Domain/application tests use JUnit 5, Mockito, AssertJ, and `ReflectionTestUtils` where entity IDs are needed.
- Phase 9 should lean on unit tests for `CodexProcessRunner`, execution registry, output validator, action draft validator, and fake process runner paths. Full Spring context tests are not needed for most gateway logic.

### Frontend

- API modules call `axiosInstance` with paths relative to `/api`, e.g. `/teams/{teamId}/projects/{projectId}/issues`.
- React Query keys are centralized in `client/src/constants/query-keys.ts`.
- There are no React component unit tests in the current frontend test harness. Frontend verification should rely on TypeScript build, API function tests only if a pure testable helper is introduced, and optional Playwright/browser smoke in later verification.
- The minimal `AI-RUN-01` surface can be a small status badge/hook in the project workspace shell, not the final chat UI.
- Visible strings must go through `client/src/i18n/locales/{ko,en}/translation.json`.

## Local Codex CLI Findings

`codex exec --help` confirms the local CLI supports:

- prompt from stdin via `-`
- `--cd <DIR>`
- `--sandbox <read-only|workspace-write|danger-full-access>`
- `--output-schema <FILE>`
- `--output-last-message <FILE>`
- `--json`
- config overrides through `-c key=value`

`codex status` failed in this non-TTY runtime with `Error: stdin is not a terminal`. Therefore Phase 9 provider status should not depend only on `codex status`; it should use PATH/config executable checks plus a lightweight `codex exec` probe or map non-TTY status failure carefully.

## Recommended Technical Shape

### Backend Package Layout

```text
src/main/java/com/smarterd/api/ai
src/main/java/com/smarterd/api/ai/dto
src/main/java/com/smarterd/application/ai
src/main/java/com/smarterd/application/ai/provider
src/main/java/com/smarterd/application/ai/prompt
src/main/java/com/smarterd/application/ai/validation
src/main/java/com/smarterd/config/ai
src/main/java/com/smarterd/domain/ai
src/main/resources/ai/prompts
```

### Configuration

Add `smart-erd.ai.*` configuration with:

- `provider`: `noop` or `local-codex`
- `codex.executable`: nullable configured executable; fallback to `codex` on PATH
- `execution.timeout`: default 60 seconds
- `execution.retention`: default 15 minutes
- `smoke.enabled`: default false
- optional Codex auth/config location allowlist if needed by the local CLI

### Provider Interfaces

Core types should be framework-neutral:

- `AiProvider`
- `AiProviderStatus`
- `AiProviderRequest`
- `AiProviderResult`
- `AiExecutionGateway`
- `AiExecutionStatusStore`
- `AiExecutionAuditService`
- `ProviderOutputValidator`
- `ActionDraftValidator`

### Local Codex Process Boundary

`CodexProcessRunner` should:

- accept a structured runner request, not raw shell fragments
- build `List<String>` argv with `codex`, `exec`, `--cd`, temp cwd, `--sandbox`, `workspace-write`, and `--output-schema`
- use stdin or controlled temp prompt file
- run in a fresh temp directory
- use allowlisted env only
- kill process on timeout/cancel
- return redacted process result metadata and stdout for validator only
- never expose raw stderr to controller/frontend/audit

### Status and Cancellation

Use an in-memory registry with:

- `executionId`
- `requestedBy`
- `teamId`
- `projectId`
- `state`
- `createdAt`
- `startedAt`
- `completedAt`
- `provider`
- `promptVersion`
- cancellation handle while running
- terminal-state compare-and-set or equivalent synchronization

Unknown or expired execution IDs should use the existing not-found path. Repeated cancel against terminal execution returns the current terminal status.

### Output Contract

Provider output should validate to a DTO like:

- `answer`
- `actions`
- `error`

Action drafts are only future proposals. Phase 9 should reject destructive/delete/bulk destructive proposals even if they appear only as drafts, and should default Noop to empty actions.

## Validation Architecture

Dimension 1: Authorization preflight

- Test that invalid team/project/selected resource fails before provider invocation.
- Test that another user cannot inspect or cancel an execution.

Dimension 2: Process runner security

- Test argv has no shell entry.
- Test temp cwd is used.
- Test sandbox is `workspace-write`.
- Test approval is `never` through supported CLI/config mechanism.
- Test request/JWT/DB/`SMART_ERD_*`/`SPRING_*` env values are excluded.

Dimension 3: Provider output validation

- Test valid answer-only response.
- Test invalid JSON maps to `OUTPUT_VALIDATION_FAILED`.
- Test missing/invalid fields fail.
- Test destructive/delete/bulk destructive actions fail.

Dimension 4: Execution lifecycle

- Test `QUEUED -> RUNNING -> SUCCEEDED`.
- Test timeout -> `TIMED_OUT`.
- Test cancel -> `CANCELLED`.
- Test cancel/timeout/process completion race with first terminal transition wins.
- Test terminal immutability and repeated cancel.
- Test retention expiry -> not found.

Dimension 5: Metadata-only audit

- Test saved audit contains execution metadata and redacted error only.
- Test audit never stores prompt/context/model response/token/cookie/credential/stdout/stderr.

Dimension 6: Frontend status

- Test TypeScript build catches API/status DTO mismatches.
- Add typed `aiProviderApi` and `queryKeys.aiProvider.status`.
- Provide minimal status badge or hook for `AI-RUN-01`.

## Risks and Constraints

- `codex status` may require a TTY; status probing should not assume it works in all backend contexts.
- Local Codex CLI auth material belongs to the user's machine and must be treated as provider credential material.
- Backend process env contains sensitive values in this app (`SMART_ERD_JWT_SECRET`, datasource properties). Allowlisting is mandatory.
- Phase 9 must not implement rich project read tools, app chat, approval UI, or write execution.
- The synchronous execute API still needs internal cancellability and terminal-state discipline.

## Planning Recommendation

Use three implementation plans:

1. Backend gateway contract, Noop provider, output validation, execution registry, metadata-only audit, and controller API.
2. Local Codex adapter and process-runner hardening.
3. Frontend API/status surface plus end-to-end contract verification.

This keeps the highest-risk backend contract first, isolates OS process execution into a second wave, and leaves the minimal user-facing status integration for the final wave.

## Research Complete

Phase 9 can be planned from the existing context and codebase. No unresolved research blocker remains.
