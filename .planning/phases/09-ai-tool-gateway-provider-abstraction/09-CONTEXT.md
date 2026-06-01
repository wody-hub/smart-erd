# Phase 9: AI Tool Gateway + Provider Abstraction - Context

**Gathered:** 2026-05-29
**Updated:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers the AI execution gateway foundation for Smart-ERD. It defines the backend provider abstraction, local Codex process adapter, provider status/execute/cancel APIs, structured response envelope, prompt template loading, output validation, and metadata-only execution audit base.

This phase does not build the app chat UI, rich read tools, approval UI, write execution tools, hosted provider integration, API key management, or autonomous action execution.

</domain>

<decisions>
## Implementation Decisions

### Codex Execution Boundary
- **D-01:** The primary Local Codex Adapter runs in the Spring backend, not Electron main. The backend executes `codex exec` with Java `ProcessBuilder`.
- **D-02:** Phase 9 assumes the Spring backend is running on the user's PC and the OS user running the backend already has Codex CLI installed and logged in.
- **D-03:** React uses a shared `aiProviderApi` that calls Spring backend HTTP endpoints in both Web and Electron. Electron IPC is not required for Phase 9.
- **D-04:** Implement backend `AiProvider` abstraction with at least `NoopAiProvider` and `LocalCodexProcessProvider`.
- **D-05:** Do not implement hosted providers, OpenAI API key storage, Ollama, Claude, or server-side shared credential flows in Phase 9.

### Codex Execution Permissions
- **D-06:** Each `codex exec` call uses a fresh temporary working directory. It must not run from the Smart-ERD repository or arbitrary user filesystem paths.
- **D-07:** Use Codex `workspace-write` sandbox scoped to the temporary cwd. Treat stdout structured JSON as the only trusted provider result.
- **D-08:** Ignore temp file outputs by default. Temp files may be kept only as controlled debug artifacts if explicitly designed.
- **D-09:** The gateway builds a request-specific server-side context bundle after authorization and scope checks, then passes only sanitized JSON to Codex.
- **D-10:** Provider executions get an `executionId`, a configurable timeout with 60 seconds as the default, and user cancellation. Cancel kills the Codex child process and records `CANCELLED`.
- **D-11:** Automatic retry is out of scope for Phase 9.

### Codex Process Runner Security Contract
- **D-36:** `CodexProcessRunner` builds argv as an array and never builds a shell command string. Do not use `/bin/sh -c`, `cmd /c`, or interpolated shell arguments.
- **D-37:** The runner uses non-interactive `codex exec` only, with `--cd` or equivalent working-root configuration pointing at the fresh temporary directory.
- **D-38:** The child Codex session uses `workspace-write` scoped to the temporary directory and approval policy `never`.
- **D-39:** The runner requests structured output through a generated output schema file when the installed Codex CLI supports it. If unavailable, the prompt template must include the schema contract and the backend validator remains authoritative.
- **D-40:** Prompt/context input is fed through stdin or a controlled temporary file, not through shell-interpolated command arguments.
- **D-41:** The child process environment is allowlisted. Do not inherit the backend process environment wholesale.
- **D-42:** Do not pass request headers, access tokens, refresh tokens, session cookies, database credentials, `SMART_ERD_*`, `SPRING_*`, or arbitrary host environment variables to Codex.
- **D-43:** Treat Codex CLI auth material as provider credential material. It may be used by the CLI, but must never be copied into prompt text, provider output, audit rows, logs, or frontend responses.

### Provider Response JSON Contract
- **D-12:** Provider response envelope includes answer/message fields and an `actions` array for action proposal skeletons. Phase 9 does not execute actions.
- **D-13:** Action proposal skeleton locks common fields only: `id`, `type`, `title`, `summary`, `riskLevel`, `requiresApproval`, and generic `payload`.
- **D-14:** Concrete write payload schemas are deferred to Phase 11/12.
- **D-15:** Provider execution failures use a ProblemDetail-style object inside the provider response, for example `error: { type, title, detail, retryable }`.
- **D-16:** HTTP request/auth/validation failures continue to use the existing backend API error handling path. Provider execution failure can return HTTP 200 with `status: FAILED`.
- **D-17:** If `codex exec` stdout fails JSON parse or DTO/schema validation, Phase 9 fails immediately with `OUTPUT_VALIDATION_FAILED`.
- **D-18:** No raw text fallback for invalid provider output.
- **D-44:** Every non-empty action draft must set `requiresApproval=true`.
- **D-45:** Action draft `riskLevel` must be a known non-destructive enum value.
- **D-46:** Delete, destructive, or bulk destructive action types are rejected even as proposals.
- **D-47:** Unknown action types are allowed only as unsupported drafts and must not be executable.
- **D-48:** The `noop` provider returns an empty `actions` array by default unless a test explicitly needs a draft.

### Gateway API and Status Model
- **D-19:** Use synchronous execute calls that return the final result and include `executionId`.
- **D-20:** Backend keeps running and recently completed execution status in memory for a configurable retention window. The default is 15 minutes.
- **D-21:** Phase 9 API contract includes:
  - `GET /api/ai/provider/status`
  - `POST /api/ai/provider/execute`
  - `GET /api/ai/provider/executions/{executionId}`
  - `POST /api/ai/provider/executions/{executionId}/cancel`
- **D-22:** Execution states are `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `TIMED_OUT`, and `CANCELLED`.
- **D-23:** Provider availability uses enum statuses, not boolean-only status: `AVAILABLE`, `NOT_CONFIGURED`, `CODEX_NOT_FOUND`, `CODEX_NOT_LOGGED_IN`, and `UNSUPPORTED_ENVIRONMENT`.
- **D-24:** Full provider registry and capability matrix are out of scope for Phase 9.
- **D-49:** Expired or unknown `executionId` values use the existing not-found error path.
- **D-50:** Terminal states are immutable. Repeated cancel requests for a terminal execution return the current terminal state.
- **D-51:** Timeout, process completion, and cancel race through an atomic terminal-state transition. The first terminal transition wins and must be tested.
- **D-52:** Execution status and cancel lookup are scoped to the original `requestedBy` user and execution metadata.
- **D-53:** Provider status may be global to the configured backend runtime, but it must not include user secrets or machine paths.

### Authorization and Scope Controls
- **D-54:** The gateway verifies authorization before prompt rendering, process start, provider input creation, or audit detail creation.
- **D-55:** The gateway verifies `teamId` membership for read-only AI execution.
- **D-56:** The gateway verifies `projectId` belongs to the requested team and is visible to the user.
- **D-57:** Optional `selectedResource` must be validated against the requested team/project and resource type before inclusion in context.

### Prompt and Harness Separation
- **D-25:** Prompt Engine uses versioned resource templates under `src/main/resources/ai/prompts`.
- **D-26:** Provider request/result metadata includes `promptVersion`.
- **D-27:** Phase 9 context envelope starts minimal: `teamId`, `projectId`, `loginId` or user identifier, `locale`, `userMessage`, optional `selectedResource`, `requestId`/`executionId`, and `timestamp`.
- **D-28:** Project summary, WBS, issue, TODO, and work-history context enrichment belongs to Phase 10 read tools.
- **D-29:** Output Validator uses Jackson JSON parse plus Java record/DTO mapping and Bean Validation.
- **D-30:** Phase 9 includes a metadata-only DB audit table skeleton for AI executions.
- **D-31:** Audit metadata may include `executionId`, `provider`, `promptVersion`, `status`, `availabilityStatus` or `errorType`, `durationMs`, `requestedBy`, `teamId`, `projectId`, `createdAt`, and redacted error title/detail.
- **D-32:** Do not store raw prompt, raw context bundle, raw model response, access token, session cookie, or credential in Phase 9 audit persistence.

### Frontend Status Surface
- **D-58:** Phase 9 includes either a minimal user-visible provider status surface or a reusable provider status hook so `AI-RUN-01` is covered without building the final app chat UI.

### Testing Decisions
- **D-33:** Required test coverage includes the Noop provider path.
- **D-34:** Required test coverage includes fake process runner failure paths: Codex missing, timeout, invalid JSON, and cancel.
- **D-35:** Include a local Codex happy-path smoke, but keep it environment-dependent and separable from default CI/general test runs.
- **D-59:** Required tests include authorization preflight for `teamId`, `projectId`, `selectedResource`, cross-user execution status lookup, and cross-user cancel denial.
- **D-60:** Required tests include child environment filtering that proves request headers, JWTs, DB credentials, broad backend env vars, `SMART_ERD_*`, and `SPRING_*` are not passed to Codex.
- **D-61:** Required tests include command builder argv construction with no shell, fresh temp cwd, sandbox/approval flags, and structured output request behavior.
- **D-62:** Required tests include action draft validation for destructive/delete/bulk destructive proposals and unsupported unknown types.
- **D-63:** Required tests include retention expiry, repeated cancel, timeout/cancel races, and terminal-state immutability.
- **D-64:** Required frontend tests include provider status typing and the minimal status surface or reusable hook.

### the agent's Discretion
- The planner may choose exact package names and DTO class names, but must preserve the backend provider abstraction, process-runner boundary, HTTP API shape, status enums, and metadata-only audit policy above.
- The planner may choose implementation mechanics for timeout and retention, but the default timeout is 60 seconds and the default completed-status retention is 15 minutes unless a documented implementation constraint is found and recorded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Requirements
- `.planning/PROJECT.md` — v1.1 milestone goals, AI safety constraints, provider abstraction and approval-gated AI principle.
- `.planning/REQUIREMENTS.md` — AI-RUN and AI-SEC requirements mapped to Phase 9.
- `.planning/ROADMAP.md` — Phase 9 goal, dependencies, requirements, and success criteria.
- `README.md` — AI extension architecture principles, Harness Engineering sequence, AI output rules, and forbidden implementation patterns.
- `docs/superpowers/specs/2026-05-29-phase-9-ai-execution-gateway-architecture-design.md` — approved and hardened architecture design; downstream agents must read for security contract, authorization, status surface, command runner, action draft validation, retention, and race testing details.

### Codebase Architecture Maps
- `.planning/codebase/STACK.md` — Spring Boot/React/Electron stack, testing tools, and runtime assumptions.
- `.planning/codebase/INTEGRATIONS.md` — current auth, PostgreSQL, Redis, WebSocket, environment, and external integration state.
- `.planning/codebase/ARCHITECTURE.md` — backend API/Application/Domain layering, frontend React Query/Zustand patterns, and error-handling conventions.

### Existing Backend API and PM Domain Boundaries
- `src/main/java/com/smarterd/api/project/ProjectIssueController.java` — existing issue create/update/status API style.
- `src/main/java/com/smarterd/api/project/ProjectTodoController.java` — existing personal TODO API style.
- `src/main/java/com/smarterd/api/project/WbsController.java` — existing WBS, comments, activities, and work-history API style.
- `src/main/java/com/smarterd/domain/pm/issue/service/ProjectIssueService.java` — issue service boundary to reuse in later write phases.
- `src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java` — TODO service boundary to reuse in later write phases.
- `src/main/java/com/smarterd/domain/pm/history/service/WorkItemHistoryService.java` — WBS comment/activity service boundary.

### Existing Frontend API Patterns
- `client/src/api/issuesApi.ts` — frontend issue API function style.
- `client/src/api/projectTodoApi.ts` — frontend TODO API normalization and function style.
- `client/src/api/wbsApi.ts` — frontend WBS comment/activity API style.
- `client/src/constants/query-keys.ts` — query key organization to extend in later UI phases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GlobalExceptionHandler` and localized domain exception pattern: keep request/auth/validation HTTP failures consistent with current backend behavior.
- PM service boundaries (`ProjectIssueService`, `ProjectTodoService`, `WorkItemHistoryService`): later action execution must call existing domain/application services rather than direct repositories.
- React Query API modules (`issuesApi.ts`, `projectTodoApi.ts`, `wbsApi.ts`): `aiProviderApi` should follow the same typed function pattern.

### Established Patterns
- Backend is a layered monolith: new AI HTTP controllers should stay thin and delegate to application/provider services.
- Domain and service layers must not depend on a specific AI vendor SDK or CLI directly; put the local Codex process details behind an adapter/port.
- Existing README requires Harness-style flow and structured JSON AI output. Phase 9 should implement the first concrete slice of that harness.
- DTOs are Java records with Bean Validation where relevant; use this for provider request/response and output validation.

### Integration Points
- Add new backend package area for AI gateway/provider abstraction under the existing API/Application style.
- Add Flyway migration for the metadata-only AI execution audit table.
- Add prompt templates under `src/main/resources/ai/prompts`.
- Add frontend `aiProviderApi` that calls backend HTTP in Web and Electron.
- Add minimal frontend provider status surface or reusable status hook for `AI-RUN-01`.
- Add tests around provider status, execute, cancel, Noop provider, fake process runner, output validation, local Codex smoke, authorization preflight, cross-user status/cancel denial, command runner hardening, environment filtering, action draft validation, and retention/race semantics.

</code_context>

<specifics>
## Specific Ideas

- Use Java `ProcessBuilder`, not shell-string execution. Do not build `/bin/sh -c` or `cmd /c` commands from user input.
- Allow only the `codex exec` command path selected by configuration or PATH lookup; do not expose arbitrary command execution.
- The local Codex process provider assumes the backend host user is already logged into Codex.
- Local Codex smoke should be opt-in or profile/flag gated because it depends on the developer machine state.
- Provider execution failures should be diagnosable without leaking raw prompt/context/model output into persistent storage.
- Keep provider status responses free of user secrets, auth/config paths, raw stderr, raw stdout, and machine-local sensitive paths.

</specifics>

<deferred>
## Deferred Ideas

- Add one-shot correction retry for invalid provider JSON output in a later phase.
- Add JSON Schema file validation for provider response contracts in a later phase.
- Add prompt management domain or admin UI in a later phase.
- Add full audit payload retention only after redaction, retention, and privacy policy are designed.
- Add Electron IPC or local agent adapter later if remote backend plus user-local Codex becomes necessary.
- Add hosted provider implementations, API key storage, Ollama, Claude, or OpenAI API adapters in later phases.

</deferred>

---

*Phase: 9-AI Tool Gateway + Provider Abstraction*
*Context gathered: 2026-05-29*
*Context updated: 2026-06-01*
