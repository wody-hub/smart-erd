# Phase 9 AI Execution Gateway Architecture Design

Date: 2026-05-29
Status: Approved for planning

## Purpose

Phase 9 creates the safe execution foundation for app-based AI features in Smart ERD. The phase does not build the final chatbot experience or execute write actions. It delivers the backend AI execution gateway, provider abstraction, local Codex process provider, structured output validation, status/cancel APIs, and metadata-only audit base.

The design follows the existing layered monolith and README AI harness rules:

- Controllers stay thin.
- Domain and PM modules do not know Codex CLI.
- AI output is structured JSON only.
- Unvalidated AI output is not persisted or applied.
- Approval-gated write execution is deferred to later phases.

## Scope

In scope:

- HTTP endpoints for provider status, execute, execution status, and cancel.
- `AiExecutionGateway` as the central execution module.
- Config-selected provider: `noop` or `local-codex`.
- `NoopAiProvider` that always returns a valid fixed success response.
- `LocalCodexProcessProvider` that runs `codex exec` through Java `ProcessBuilder`.
- Lightweight Codex availability probe for status.
- 60 second default timeout, configurable.
- Child process cancellation for running Codex executions.
- Structured JSON parsing and DTO/Bean Validation.
- Metadata-only AI execution audit table.
- Frontend `aiProviderApi` over backend HTTP for both Web and Electron.
- Minimal user-visible provider status surface or hook for `AI-RUN-01`. This is not the app chat UI.

Out of scope:

- Electron IPC for Codex execution.
- Hosted providers, OpenAI API key storage, Ollama, Claude, or server-shared credentials.
- App chat UI.
- Rich read tools for project, WBS, issue, My Task, or history data.
- Approval UI and action execution.
- Automatic retry or correction for invalid provider output.
- Raw prompt, raw context, raw response, token, cookie, or credential persistence.

## Architecture

Use `AiExecutionGateway` as the deep module for the execution lifecycle. The gateway owns execution IDs, state transitions, timeout handling, cancellation coordination, provider invocation, output validation, and audit metadata recording.

Suggested package layout:

- `src/main/java/com/smarterd/api/ai`
  - `AiProviderController`
  - request and response DTO records
- `src/main/java/com/smarterd/application/ai`
  - `AiExecutionGateway`
  - execution status store
  - execution commands/results
  - authorization preflight for AI execution scopes
- `src/main/java/com/smarterd/application/ai/provider`
  - `AiProvider` interface
  - `NoopAiProvider`
  - `LocalCodexProcessProvider`
  - `CodexProcessRunner`
- `src/main/java/com/smarterd/application/ai/prompt`
  - prompt template loader
  - prompt version metadata
- `src/main/java/com/smarterd/application/ai/validation`
  - provider output validator
- `src/main/java/com/smarterd/domain/ai`
  - `AiExecutionAudit` metadata entity
  - repository
- `src/main/resources/ai/prompts`
  - versioned prompt templates

The external seam is the gateway interface used by the controller. The provider seam is real because Phase 9 has two adapters: `NoopAiProvider` and `LocalCodexProcessProvider`.

## Authorization And Scope

The gateway must verify the authenticated user before any prompt or provider input is built.

Required checks:

- `teamId` membership is verified for read-only execution.
- `projectId` belongs to the team and is visible to the user.
- `selectedResource` is optional, but when present it must be validated against the requested team/project and resource type.
- Execution status and cancel requests are scoped to the original `requestedBy` user and execution metadata. A user must not inspect or cancel another user's execution.
- Provider status may be global to the configured backend runtime, but it must not include user secrets or machine paths.

Failed authorization uses the existing backend exception handling path and must happen before prompt rendering, process start, or audit detail creation.

## Data Flow

Execute flow:

1. Frontend calls `POST /api/ai/provider/execute`.
2. Controller passes JWT subject, request DTO, and locale to `AiExecutionGateway`.
3. Gateway creates `executionId` and records `QUEUED`, then `RUNNING`.
4. Gateway verifies the requested `teamId`, `projectId`, and optional `selectedResource` scope.
5. Gateway builds a minimal sanitized context envelope:
   - `teamId`
   - `projectId`
   - `loginId`
   - `locale`
   - `userMessage`
   - optional `selectedResource`
   - `executionId`
   - `timestamp`
6. Prompt engine loads a versioned prompt template and produces provider input.
7. Selected provider runs:
   - `noop` returns fixed valid JSON.
   - `local-codex` runs `codex exec` in a fresh temporary working directory.
8. Output validator parses stdout JSON and validates the DTO contract.
9. Gateway records `SUCCEEDED`, `FAILED`, or `TIMED_OUT`.
10. Gateway persists metadata-only audit.
11. API returns result plus `executionId`.

Cancel flow:

1. Frontend calls `POST /api/ai/provider/executions/{executionId}/cancel`.
2. Gateway checks the current execution state.
3. If running, gateway asks the provider runner to terminate the child process.
4. Gateway records `CANCELLED`.
5. If already completed, gateway returns the current state without changing it.

Execution status retention:

- Running and recently completed executions are kept in memory for a configurable retention window. The default is 15 minutes.
- Expired or unknown `executionId` values return the existing not-found error path.
- Terminal states are immutable. Repeated cancel requests for a terminal execution return the current terminal state.
- Timeout, process completion, and cancel are resolved through an atomic terminal-state transition. The first terminal transition wins, and tests must cover timeout/cancel races.

## HTTP Contract

Phase 9 endpoints:

- `GET /api/ai/provider/status`
- `POST /api/ai/provider/execute`
- `GET /api/ai/provider/executions/{executionId}`
- `POST /api/ai/provider/executions/{executionId}/cancel`

Execution states:

- `QUEUED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`
- `TIMED_OUT`
- `CANCELLED`

Provider availability statuses:

- `AVAILABLE`
- `NOT_CONFIGURED`
- `CODEX_NOT_FOUND`
- `CODEX_NOT_LOGGED_IN`
- `UNSUPPORTED_ENVIRONMENT`

Provider execution failures may return HTTP 200 with a failed provider result:

```json
{
  "executionId": "example",
  "status": "FAILED",
  "error": {
    "type": "OUTPUT_VALIDATION_FAILED",
    "title": "Provider output validation failed",
    "detail": "The provider returned an invalid response.",
    "retryable": false
  }
}
```

HTTP request, authentication, authorization, DTO validation, and missing execution errors continue through the existing backend exception handling path.

## Provider Output Contract

The provider response contains a user-facing answer and optional action draft skeletons. Phase 9 does not execute actions.

Minimum response shape:

```json
{
  "answer": "string",
  "actions": [
    {
      "id": "string",
      "type": "string",
      "title": "string",
      "summary": "string",
      "riskLevel": "LOW",
      "requiresApproval": true,
      "payload": {}
    }
  ]
}
```

The action payload remains generic in Phase 9. Concrete write payload schemas belong to later action and approval phases.

Action draft validation is still defensive in Phase 9:

- Every non-empty action must set `requiresApproval=true`.
- `riskLevel` must be a known non-destructive enum value.
- Delete, destructive, or bulk destructive action types are rejected even as proposals.
- Unknown action types are allowed only as unsupported drafts and must not be executable.
- The `noop` provider should return an empty `actions` array unless a test explicitly needs a draft.

## Local Codex Provider

`LocalCodexProcessProvider` runs in the Spring backend, not in Electron. Web and Electron frontends both call backend HTTP.

Execution rules:

- Use Java `ProcessBuilder`, not shell string execution.
- Run only the configured or PATH-resolved Codex executable.
- Use a fresh temporary working directory.
- Do not run from the Smart ERD repository or arbitrary user-selected paths.
- Use Codex sandboxing scoped to the temporary working directory.
- Trust only structured stdout JSON after validation.
- Do not expose raw stdout or stderr to the user.
- Do not persist raw stdout or stderr.

`CodexProcessRunner` has a security contract:

- Build argv as an array, never a shell command string.
- Use non-interactive `codex exec`.
- Use `--cd` or equivalent working-root configuration pointing at the temporary directory.
- Use `workspace-write` sandbox scoped to the temporary directory.
- Use approval policy `never` for the child Codex session.
- Request structured output through a generated output schema file when the installed Codex CLI supports it. If not supported, the prompt template must include the schema contract and the backend validator remains authoritative.
- Feed prompt/context through stdin or a controlled temp file, not through interpolated shell arguments.
- Do not inherit the backend process environment wholesale.
- Pass only allowlisted environment variables needed for process execution and Codex authentication, such as `PATH`, locale, temp directory, and the Codex CLI auth/config location when required.
- Do not pass request headers, access tokens, refresh tokens, session cookies, database credentials, `SMART_ERD_*`, `SPRING_*`, or arbitrary host environment variables to the child process.
- Treat Codex CLI's own auth material as provider credential material. It may be used by the CLI to authenticate, but it must never be copied into prompt text, provider output, audit rows, logs, or frontend responses.

Status uses a lightweight probe, such as `codex status` or a minimal `codex exec` probe. The exact probe can be chosen during implementation after confirming the installed Codex CLI behavior, but it must follow the same environment and no-shell security contract.

## Audit

Persist only metadata:

- `executionId`
- `provider`
- `promptVersion`
- `status`
- `availabilityStatus` or `errorType`
- `durationMs`
- `requestedBy`
- `teamId`
- `projectId`
- `createdAt`
- redacted error title/detail if needed

Do not persist:

- raw prompt
- raw context bundle
- raw model response
- raw stdout/stderr
- access token
- session cookie
- DB credential
- arbitrary command text from the user

## Error Handling

Provider execution errors are normalized into provider result errors:

- `CODEX_NOT_FOUND`
- `CODEX_NOT_LOGGED_IN`
- `NOT_CONFIGURED`
- `UNSUPPORTED_ENVIRONMENT`
- `PROCESS_FAILED`
- `TIMED_OUT`
- `CANCELLED`
- `OUTPUT_VALIDATION_FAILED`

Invalid JSON and DTO validation failures immediately become `OUTPUT_VALIDATION_FAILED`. Phase 9 intentionally does not perform correction retry. A later phase may add one-shot correction retry as part of the AI harness.

## Frontend Integration

Add a typed `aiProviderApi` module following the existing frontend API style.

Frontend rules:

- Use backend HTTP for both Web and Electron.
- Do not use Electron IPC for Codex execution in Phase 9.
- Treat provider failures as execution results, not necessarily thrown transport errors.
- Add query keys under the existing query key structure when UI integration begins.
- Provide a minimal provider status display or reusable status hook so `AI-RUN-01` is covered without building the final chat UI.

Phase 9 may add the API module and types without building the final app chat UI.

## Testing

Backend tests:

- `NoopAiProvider` returns a valid success response.
- Provider configuration selects `noop` or `local-codex`.
- Gateway state transitions from `QUEUED` to `RUNNING` to `SUCCEEDED`.
- Gateway rejects unauthorized `teamId`, `projectId`, `selectedResource`, execution status, and cancel access before provider input is built.
- Provider failure records `FAILED` with error object.
- Timeout records `TIMED_OUT`.
- Cancel terminates the child process and records `CANCELLED`.
- Invalid stdout JSON records `OUTPUT_VALIDATION_FAILED`.
- Audit persistence contains metadata only.
- Child process environment tests prove request headers, JWTs, DB credentials, and broad backend env vars are not passed to Codex.
- Command builder tests prove argv construction uses no shell, fresh temp cwd, sandbox/approval flags, and structured output request.
- Action draft validator tests reject destructive, delete, and bulk destructive proposals.
- Retention and race tests cover expired executions, repeated cancel, timeout/cancel races, and terminal-state immutability.
- MVC tests cover status, execute, execution status, and cancel endpoints.

Frontend tests:

- `aiProviderApi` uses backend HTTP in Web and Electron.
- Provider status response maps to typed availability status.
- Minimal status surface or hook can show Local Codex availability to the user.
- Execute response maps to typed execution result.
- Failed provider result can be displayed without treating it as a thrown HTTP error.

Local Codex smoke:

- Opt-in only through profile, flag, or environment variable.
- Excluded from default CI/general test runs.
- Verifies that the local machine can run `codex exec` and return structured JSON.

## Planning Consequences

The implementation plan should start with the execution gateway and provider interfaces, then add the `noop` provider, then local Codex runner, then audit and frontend API types. Rich project data context, app chat UI, approval UI, and write execution should remain in later phases.

The existing milestone wording that mentions "local/Electron MVP" should be interpreted as "local backend MVP usable from Web and Electron over HTTP." Electron IPC is not part of Phase 9.
