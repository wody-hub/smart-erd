# Phase 9: AI Tool Gateway + Provider Abstraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 9-AI Tool Gateway + Provider Abstraction
**Areas discussed:** Codex execution boundary, Codex execution permissions, Provider response JSON contract, Gateway API and status model, Prompt and Harness separation

---

## Codex Execution Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Electron main process | Renderer calls Electron IPC; Electron main executes local Codex CLI. | |
| Spring backend | Backend executes local Codex CLI with Java `ProcessBuilder`. | ✓ |
| Hybrid | Backend owns provider contracts while Electron owns local Codex execution. | |

**User's choice:** Backend execution, assuming Codex CLI is installed and logged in for the OS user running the backend.
**Notes:** The initial Electron IPC direction was revised. The final decision is Web/Electron both call Spring backend HTTP APIs. Electron IPC/local agent is deferred unless remote backend plus user-local Codex becomes necessary.

| Option | Description | Selected |
|--------|-------------|----------|
| Electron IPC-only API | Renderer uses `window.electronAPI` allowlisted calls. | |
| Shared frontend API with internal branching | React calls a common `aiProviderApi`; implementation can branch internally. | |
| Backend HTTP API | React calls backend provider endpoints in Web and Electron. | ✓ |

**User's choice:** Backend HTTP for both Web and Electron.
**Notes:** This keeps provider abstraction, status, context bundle, validation, cancel, and audit centered in Spring.

| Option | Description | Selected |
|--------|-------------|----------|
| Status endpoint only | Web shows provider unavailable until a hosted provider exists. | |
| Status plus execute stub | Shape execute API but no real provider implementation. | |
| Backend provider interface | Implement provider interface, Noop provider, Local Codex process provider, status/execute endpoints, and shared DTOs. | ✓ |

**User's choice:** Backend provider interface.
**Notes:** Hosted providers and API key storage stay out of Phase 9.

---

## Codex Execution Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Temporary working directory | Fresh temp cwd per execution; Codex does not run in repo/user paths. | ✓ |
| App data directory | Stable local workspace for AI execution artifacts. | |
| Project repository directory | Run inside Smart-ERD repo. | |

**User's choice:** Temporary working directory.
**Notes:** Codex receives sanitized server-built context only.

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only sandbox | Most restrictive, but may conflict with CLI temp writes. | |
| Workspace-write sandbox limited to temp cwd | Allows writes only inside the temp workspace. | ✓ |
| Codex default sandbox | Delegates safety boundary to user Codex settings. | |

**User's choice:** Workspace-write sandbox limited to temp cwd.
**Notes:** Only stdout structured JSON is trusted.

| Option | Description | Selected |
|--------|-------------|----------|
| Current screen and selected resource only | Small prompt, limited context. | |
| Request-specific server-side context bundle | Backend builds scoped sanitized context for each request. | ✓ |
| Two-pass tool request and follow-up lookup | Codex requests tools, server fetches data, then calls Codex again. | |

**User's choice:** Request-specific server-side context bundle.
**Notes:** Rich read tool context is deferred to Phase 10.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed timeout only | Simple timeout, no user cancel. | |
| Timeout plus user cancel | Execution id, timeout, cancel kills child process. | ✓ |
| Timeout plus cancel plus retry policy | Adds retry classification and automatic retry. | |

**User's choice:** Timeout plus user cancel.
**Notes:** Retry is deferred.

---

## Provider Response JSON Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Answer only | Message/citations/error only. | |
| Answer plus tool request | AI can request additional tools. | |
| Answer plus action proposal skeleton | Response includes `actions: []` for future approval pipeline. | ✓ |

**User's choice:** Answer plus action proposal skeleton.
**Notes:** Phase 9 does not execute actions.

| Option | Description | Selected |
|--------|-------------|----------|
| Untyped placeholder | `actions: unknown[]`. | |
| Common fields only | Lock id/type/title/summary/risk/requiresApproval/payload. | ✓ |
| All v1.1 write action types | Lock concrete write action schemas now. | |

**User's choice:** Common fields only.
**Notes:** Concrete payload schemas move to Phase 11/12.

| Option | Description | Selected |
|--------|-------------|----------|
| Simple message only | `errorMessage: string`. | |
| Standard error code and message | `{ code, message, retryable }`. | |
| ProblemDetail-style provider error object | `{ type, title, detail, retryable }` inside provider response. | ✓ |

**User's choice:** ProblemDetail-style provider error object.
**Notes:** Existing backend HTTP error handling still applies to invalid requests, auth failures, and validation failures.

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate failure | Invalid JSON fails as `OUTPUT_VALIDATION_FAILED`. | ✓ |
| One-shot correction retry | Re-run Codex once to repair schema. | |
| Show raw text as fallback | Display invalid raw output to user. | |

**User's choice:** Immediate failure.
**Notes:** One-shot correction retry explicitly deferred.

---

## Gateway API and Status Model

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous execution only | Execute waits and returns result. | |
| Synchronous execution plus executionId | Execute waits, returns result and execution id; status retained briefly. | ✓ |
| Asynchronous job model | Execute returns id, UI polls for result. | |

**User's choice:** Synchronous execution plus executionId.
**Notes:** Full async job model is out of scope.

| Option | Description | Selected |
|--------|-------------|----------|
| Provider availability only | Status endpoint only. | |
| Provider availability plus execution status | Include status lookup and cancel endpoint. | ✓ |
| Full provider registry | Include provider list, selected provider, capabilities, config state. | |

**User's choice:** Provider availability plus execution status.
**Notes:** API contract includes status, execute, execution lookup, cancel.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal state | RUNNING, SUCCEEDED, FAILED, CANCELLED. | |
| Execution-flow state | QUEUED, RUNNING, SUCCEEDED, FAILED, TIMED_OUT, CANCELLED. | ✓ |
| Detailed provider step state | VALIDATING_INPUT, BUILDING_CONTEXT, CALLING_PROVIDER, etc. | |

**User's choice:** Execution-flow state.
**Notes:** Detailed provider step state is too much for Phase 9.

| Option | Description | Selected |
|--------|-------------|----------|
| Boolean-centered | `{ available, reason }`. | |
| Status enum-centered | Availability enum values. | ✓ |
| Status enum plus minimal capabilities | Add basic capability flags. | |

**User's choice:** Status enum-centered.
**Notes:** Capability matrix can be extended later.

---

## Prompt and Harness Separation

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal code prompt builder | Build prompt strings in Java code. | |
| Versioned prompt template resource | Load prompt templates from resources and track promptVersion. | ✓ |
| Prompt management domain | DB/admin UI for prompt versions. | |

**User's choice:** Versioned prompt template resource.
**Notes:** Aligns with README Harness principles without overbuilding prompt management.

| Option | Description | Selected |
|--------|-------------|----------|
| Question text only | Pass only user message. | |
| Minimal context envelope | Structured request metadata and selected resource. | ✓ |
| Include project summary data | Include project/WBS/issue/TODO summary in Phase 9. | |

**User's choice:** Minimal context envelope.
**Notes:** Rich Smart-ERD read tools belong to Phase 10.

| Option | Description | Selected |
|--------|-------------|----------|
| JSON parse only | Check stdout is JSON. | |
| JSON parse plus DTO validation | Jackson mapping and Bean Validation. | ✓ |
| JSON Schema file validation | Validate against separate JSON schema files. | |

**User's choice:** JSON parse plus DTO validation.
**Notes:** JSON Schema file validation deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Application logs only | No DB migration. | |
| DB audit table skeleton | Persist metadata-only execution audit rows. | ✓ |
| Full audit payload storage | Store raw prompt/context/response. | |

**User's choice:** DB audit table skeleton.
**Notes:** Raw prompt, context, model response, and credentials must not be stored in Phase 9.

| Option | Description | Selected |
|--------|-------------|----------|
| Noop only | Test unavailable provider path only. | |
| Noop plus fake failure paths | Add fake process runner failures. | |
| Noop plus fake failure paths plus local Codex smoke | Include environment-dependent Codex smoke separately. | ✓ |

**User's choice:** All test categories.
**Notes:** Local Codex smoke is opt-in/environment-dependent.

---

## the agent's Discretion

- Exact package/class names.
- Exact timeout default and short retention duration, as long as documented and tested.
- Exact audit table column names, as long as metadata-only policy is preserved.

## Deferred Ideas

- Add one-shot correction retry for invalid provider JSON output in a later phase.
- Add JSON Schema file validation for provider response contracts in a later phase.
- Add prompt management domain or admin UI in a later phase.
- Add full audit payload retention only after redaction, retention, and privacy policy are designed.
- Add Electron IPC or local agent adapter later if remote backend plus user-local Codex becomes necessary.
- Add hosted provider implementations, API key storage, Ollama, Claude, or OpenAI API adapters in later phases.
