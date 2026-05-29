# Phase 9: AI Tool Gateway + Provider Abstraction - Context

**Gathered:** 2026-05-29
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
- **D-10:** Provider executions get an `executionId`, a fixed timeout, and user cancellation. Cancel kills the Codex child process and records `CANCELLED`.
- **D-11:** Automatic retry is out of scope for Phase 9.

### Provider Response JSON Contract
- **D-12:** Provider response envelope includes answer/message fields and an `actions` array for action proposal skeletons. Phase 9 does not execute actions.
- **D-13:** Action proposal skeleton locks common fields only: `id`, `type`, `title`, `summary`, `riskLevel`, `requiresApproval`, and generic `payload`.
- **D-14:** Concrete write payload schemas are deferred to Phase 11/12.
- **D-15:** Provider execution failures use a ProblemDetail-style object inside the provider response, for example `error: { type, title, detail, retryable }`.
- **D-16:** HTTP request/auth/validation failures continue to use the existing backend API error handling path. Provider execution failure can return HTTP 200 with `status: FAILED`.
- **D-17:** If `codex exec` stdout fails JSON parse or DTO/schema validation, Phase 9 fails immediately with `OUTPUT_VALIDATION_FAILED`.
- **D-18:** No raw text fallback for invalid provider output.

### Gateway API and Status Model
- **D-19:** Use synchronous execute calls that return the final result and include `executionId`.
- **D-20:** Backend keeps running and recently completed execution status in memory for a short retention window.
- **D-21:** Phase 9 API contract includes:
  - `GET /api/ai/provider/status`
  - `POST /api/ai/provider/execute`
  - `GET /api/ai/provider/executions/{executionId}`
  - `POST /api/ai/provider/executions/{executionId}/cancel`
- **D-22:** Execution states are `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `TIMED_OUT`, and `CANCELLED`.
- **D-23:** Provider availability uses enum statuses, not boolean-only status: `AVAILABLE`, `NOT_CONFIGURED`, `CODEX_NOT_FOUND`, `CODEX_NOT_LOGGED_IN`, and `UNSUPPORTED_ENVIRONMENT`.
- **D-24:** Full provider registry and capability matrix are out of scope for Phase 9.

### Prompt and Harness Separation
- **D-25:** Prompt Engine uses versioned resource templates under `src/main/resources/ai/prompts`.
- **D-26:** Provider request/result metadata includes `promptVersion`.
- **D-27:** Phase 9 context envelope starts minimal: `teamId`, `projectId`, `loginId` or user identifier, `locale`, `userMessage`, optional `selectedResource`, `requestId`/`executionId`, and `timestamp`.
- **D-28:** Project summary, WBS, issue, TODO, and work-history context enrichment belongs to Phase 10 read tools.
- **D-29:** Output Validator uses Jackson JSON parse plus Java record/DTO mapping and Bean Validation.
- **D-30:** Phase 9 includes a metadata-only DB audit table skeleton for AI executions.
- **D-31:** Audit metadata may include `executionId`, `provider`, `promptVersion`, `status`, `availabilityStatus` or `errorType`, `durationMs`, `requestedBy`, `teamId`, `projectId`, `createdAt`, and redacted error title/detail.
- **D-32:** Do not store raw prompt, raw context bundle, raw model response, access token, session cookie, or credential in Phase 9 audit persistence.

### Testing Decisions
- **D-33:** Required test coverage includes the Noop provider path.
- **D-34:** Required test coverage includes fake process runner failure paths: Codex missing, timeout, invalid JSON, and cancel.
- **D-35:** Include a local Codex happy-path smoke, but keep it environment-dependent and separable from default CI/general test runs.

### the agent's Discretion
- The planner may choose exact package names and DTO class names, but must preserve the backend provider abstraction, process-runner boundary, HTTP API shape, status enums, and metadata-only audit policy above.
- The planner may choose exact timeout default and status retention duration if the values are documented and testable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Requirements
- `.planning/PROJECT.md` — v1.1 milestone goals, AI safety constraints, provider abstraction and approval-gated AI principle.
- `.planning/REQUIREMENTS.md` — AI-RUN and AI-SEC requirements mapped to Phase 9.
- `.planning/ROADMAP.md` — Phase 9 goal, dependencies, requirements, and success criteria.
- `README.md` — AI extension architecture principles, Harness Engineering sequence, AI output rules, and forbidden implementation patterns.

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
- Add tests around provider status, execute, cancel, Noop provider, fake process runner, output validation, and local Codex smoke.

</code_context>

<specifics>
## Specific Ideas

- Use Java `ProcessBuilder`, not shell-string execution. Do not build `/bin/sh -c` or `cmd /c` commands from user input.
- Allow only the `codex exec` command path selected by configuration or PATH lookup; do not expose arbitrary command execution.
- The local Codex process provider assumes the backend host user is already logged into Codex.
- Local Codex smoke should be opt-in or profile/flag gated because it depends on the developer machine state.
- Provider execution failures should be diagnosable without leaking raw prompt/context/model output into persistent storage.

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
