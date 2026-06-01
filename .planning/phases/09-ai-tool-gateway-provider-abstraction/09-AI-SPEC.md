# AI-SPEC — Phase 9: AI Tool Gateway + Provider Abstraction

> AI design contract generated inline from `$gsd-ai-integration-phase` rules. Consumed by `$gsd-plan-phase`, execution, and later eval review.

---

## 1. System Classification

**System Type:** Hybrid — Code Automation Adapter + Structured Output Gateway + Conversational Foundation

**Description:**
Phase 9 builds the safe backend execution foundation for later app AI features. Smart-ERD users will eventually ask project-management questions and request low-risk work proposals, but this phase only creates the provider gateway, local Codex process adapter, status/cancel APIs, structured output validation, and metadata-only audit base. Good output is valid JSON, scoped to the authorized team/project context, and never exposes credentials or executes business writes.

**Critical Failure Modes:**
1. Raw access tokens, refresh tokens, cookies, database credentials, or backend environment values reach a prompt, child process environment, audit row, log, or frontend response.
2. A user can execute, inspect, or cancel another user's AI execution through an execution id.
3. Local Codex is launched through shell interpolation or arbitrary command execution instead of a fixed argv contract.
4. Invalid or destructive action proposals pass validation and become executable by later phases.
5. Timeout, process completion, and cancel races produce conflicting terminal states or leaked processes.

---

## 1b. Domain Context

**Industry Vertical:** Developer tooling / SI project-management internal tooling

**User Population:** SI project managers, PM/BA roles, solution architects, and developers using Smart-ERD project hubs for WBS, issues, personal TODO, work history, and documents.

**Stakes Level:** High

**Output Consequence:** Phase 9 only returns answers and action proposal skeletons, but later phases will execute approved project issue/TODO/comment writes. A weak gateway contract now can become credential leakage, cross-project data exposure, or unsafe write execution later.

### What Domain Experts Evaluate Against

| Dimension | Good | Bad | Stakes | Source |
|-----------|------|-----|--------|--------|
| Scope fidelity | Response and status are scoped to the authenticated user's team/project and selected resource | Execution can be run or inspected across teams/projects/users | Data leakage and audit failure | `09-CONTEXT.md` D-54 to D-57 |
| Execution safety | Codex runs with fixed argv, temp cwd, sandbox, approval `never`, env allowlist, and structured output validation | Shell command strings, inherited env, raw stderr/stdout exposure, or repo cwd execution | Local machine and credential compromise | `09-CONTEXT.md` D-36 to D-43 |
| Structured output | Valid response DTO, known status enum, provider error object, and safe action draft fields | Raw text fallback, unvalidated JSON, destructive draft, or missing approval flag | Later action pipeline corruption | `09-CONTEXT.md` D-12 to D-18 and D-44 to D-48 |
| Lifecycle determinism | Execution id has one terminal state, retention expiry is not found, repeated cancel is idempotent | Timeout/cancel/process completion races mutate terminal states inconsistently | User trust and process leak risk | `09-CONTEXT.md` D-49 to D-53 |
| Observability without payload retention | Audit row has metadata and redacted error only | Raw prompt/context/model output/token stored | Privacy and security exposure | `09-CONTEXT.md` D-30 to D-32 |

### Known Failure Modes in This Domain

- Treating AI as an internal superuser and bypassing existing `ProjectContextLoader`, team membership, or project ownership checks.
- Confusing "proposal" with "execution", especially for create/update/delete action drafts.
- Letting provider status expose local machine paths, Codex auth/config paths, or command stderr.
- Using a global in-memory execution registry without `requestedBy` scoping.
- Adding frontend chat UI before gateway contracts and validation are stable.

### Regulatory / Compliance Context

No external legal regime is identified for Phase 9, but internal security controls are mandatory: credential non-disclosure, authorization before prompt construction, metadata-only audit, and no direct DB writes by AI.

### Domain Expert Roles for Evaluation

| Role | Responsibility |
|------|---------------|
| Senior backend engineer | Verify gateway lifecycle, process runner, validation, and audit contracts |
| Security reviewer | Calibrate secret/env redaction, status disclosure, and cross-user access tests |
| PM domain owner | Verify that Phase 9 does not smuggle Phase 10-12 read/write behavior into scope |

---

## 2. Framework Decision

**Selected Framework:** Local Codex CLI Adapter behind Spring `AiProvider`

**Version:** Use the installed Codex CLI that supports `codex exec`, `--cd`, `--sandbox`, `--output-schema`, `--output-last-message`, and stdin prompt input. Verified locally via `codex exec --help` on 2026-06-01.

**Rationale:**
The project has no OpenAI API key, but the user's local machine can access Codex through the CLI. Spring is already the security and domain boundary, so Phase 9 should keep all provider execution behind backend HTTP and a replaceable provider abstraction. No additional orchestration framework is needed yet because this phase performs one synchronous provider call with strict structured output, not multi-agent planning or RAG.

**Alternatives Considered:**

| Framework | Ruled Out Because |
|-----------|------------------|
| OpenAI Agents SDK | Requires API-key/provider setup that Phase 9 explicitly avoids; unnecessary for one local CLI adapter |
| LangGraph | Useful for stateful multi-step workflows, but Phase 9 is a single-call gateway with in-memory execution status |
| LangChain | Adds abstraction without a concrete need; provider abstraction is simpler in native Java |
| Ollama adapter | Future provider candidate, but not the first runtime requested for Phase 9 |
| Electron IPC adapter | Earlier option, rejected because Web and Electron should both use Spring HTTP |

**Vendor Lock-In Accepted:** Partial. Phase 9 accepts Codex CLI as the first provider implementation but locks it behind `AiProvider`, `CodexProcessRunner`, DTO validation, and prompt templates so later providers can be added without binding UI or domain services to Codex.

---

## 3. Framework Quick Reference

### Installation
```bash
# Developer machine prerequisite, not installed by Smart-ERD:
codex --version
codex exec --help
```

### Core Imports
```java
import java.lang.ProcessBuilder;
import java.nio.file.Path;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
```

### Entry Point Pattern
```bash
codex exec \
  --cd "$TEMP_WORK_DIR" \
  --sandbox workspace-write \
  --output-schema "$OUTPUT_SCHEMA_FILE" \
  - < "$PROMPT_FILE"
```

### Key Abstractions

| Concept | What It Is | When You Use It |
|---------|------------|-----------------|
| `AiExecutionGateway` | Spring application service owning execution id, state transitions, auth preflight, validation, audit, and provider call | Every `/api/ai/provider/**` request |
| `AiProvider` | Replaceable provider interface | Select `noop` or `local-codex` now; add hosted providers later |
| `CodexProcessRunner` | Narrow process boundary that creates argv, cwd, env, timeout, and cancellation behavior | Only inside `LocalCodexProcessProvider` |
| `PromptTemplateLoader` | Versioned resource prompt loader | Build provider prompt from sanitized context and schema contract |
| `ProviderOutputValidator` | Jackson + Bean Validation DTO validator | Convert stdout JSON into trusted provider response |

### Common Pitfalls
1. Do not call Codex from the React UI or Electron IPC in Phase 9.
2. Do not build a shell command string; use `ProcessBuilder(List<String>)`.
3. Do not inherit the backend environment wholesale.
4. Do not expose raw stdout/stderr to users or persist it.
5. Do not run Codex inside the Smart-ERD repository.

### Recommended Project Structure
```text
src/main/java/com/smarterd/api/ai
src/main/java/com/smarterd/application/ai
src/main/java/com/smarterd/application/ai/provider
src/main/java/com/smarterd/application/ai/prompt
src/main/java/com/smarterd/application/ai/validation
src/main/java/com/smarterd/domain/ai
src/main/resources/ai/prompts
client/src/api/aiProviderApi.ts
client/src/hooks/useAiProviderStatus.ts
client/src/components/ai/AiProviderStatusBadge.tsx
```

---

## 4. Implementation Guidance

**Model Configuration:**
No model is configured in Smart-ERD for Phase 9. The local Codex CLI uses the user's existing Codex login/config. Smart-ERD config only selects provider (`noop` or `local-codex`), executable path/PATH lookup behavior, timeout default 60 seconds, status retention default 15 minutes, and local smoke enablement.

**Core Pattern:**
Controller -> `AiExecutionGateway` -> auth preflight -> prompt/context build -> selected `AiProvider` -> output validation -> terminal state -> metadata audit -> response DTO.

**Tool Use:**
Codex is not allowed to call Smart-ERD tools in Phase 9. The only input is the server-built sanitized context envelope. Rich read tools begin in Phase 10.

**State Management:**
Running and recently completed executions stay in an in-memory registry keyed by `executionId`, with `requestedBy`, team/project metadata, atomic terminal transition, cancellation handle, and 15 minute completed-state retention. Persistent DB storage is metadata-only audit, not execution payload storage.

**Context Window Strategy:**
Phase 9 context is intentionally minimal: `teamId`, `projectId`, `loginId`, locale, user message, optional selected resource, `executionId`, timestamp, and prompt version. Project summaries, WBS, issues, TODOs, and history are Phase 10.

---

## 4b. AI Systems Best Practices

### Structured Outputs with Pydantic

The production implementation is Java DTO + Bean Validation. The equivalent conceptual output model is:

```python
from pydantic import BaseModel, Field
from typing import Any, Literal

class ActionDraft(BaseModel):
    id: str
    type: str
    title: str
    summary: str
    riskLevel: Literal["LOW", "MEDIUM"]
    requiresApproval: Literal[True]
    payload: dict[str, Any] = Field(default_factory=dict)

class ProviderError(BaseModel):
    type: str
    title: str
    detail: str
    retryable: bool

class AiProviderResponse(BaseModel):
    answer: str | None = None
    actions: list[ActionDraft] = Field(default_factory=list)
    error: ProviderError | None = None
```

Java remains authoritative: Jackson parses stdout, Bean Validation checks fields, and `ActionDraftValidator` rejects destructive/delete/bulk destructive proposals.

### Async-First Design

Phase 9 uses synchronous HTTP execute calls that return a final result plus `executionId`. Internally, the gateway still needs cancellable process state and atomic terminal transitions because user cancellation and timeout can race with process completion.

### Prompt Engineering Discipline

Keep prompt templates in `src/main/resources/ai/prompts`, version every template, separate system instructions from sanitized request context, and include the JSON contract when `--output-schema` is unavailable. No raw request headers, cookies, tokens, or database details can enter the prompt.

### Context Window Management

Do not enrich context in Phase 9 beyond the minimal envelope. If the user asks for project facts, the provider should answer that richer project reads are unavailable in this phase rather than guessing.

### Cost and Latency Budget

Local Codex latency is variable and outside backend control. Use a 60 second timeout, no automatic retry, no streaming, and opt-in local smoke tests. Default CI should test fake runners and Noop provider only.

---

## 5. Evaluation Strategy

### Dimensions

| Dimension | Rubric | Measurement Approach | Priority |
|-----------|--------|----------------------|----------|
| Credential non-exposure | Pass if child env excludes request/JWT/DB/`SMART_ERD_*`/`SPRING_*` values and responses/audits/logs omit raw stdout/stderr/auth paths | Code tests | Critical |
| Authz preflight | Pass if unauthorized team/project/resource/status/cancel requests fail before prompt/provider input creation | MVC/service tests | Critical |
| Structured output validity | Pass if invalid JSON/DTO/action draft yields `OUTPUT_VALIDATION_FAILED` and no raw text fallback | Unit tests | Critical |
| Process runner safety | Pass if argv uses no shell, temp cwd, `--sandbox workspace-write`, approval `never`, `--output-schema` when supported, stdin/temp input | Unit tests | Critical |
| Lifecycle determinism | Pass if timeout/cancel/completion first terminal transition wins, terminal states are immutable, repeated cancel is idempotent, expired id is not found | Unit tests | High |
| User-visible provider status | Pass if frontend can display typed availability for Local Codex/Noop without app chat UI | Frontend type/build and component/hook smoke | High |

### Eval Tooling

**Primary Tool:** Code-based tests first; no LLM judge required in Phase 9.

**Setup:**
```bash
./gradlew test --tests "com.smarterd.application.ai.*" --tests "com.smarterd.api.ai.*"
cd client && npm run build
```

**CI/CD Integration:**
```bash
./gradlew test
cd client && npm run build
```

### Reference Dataset

**Size:** 12 examples to start

**Composition:**
- 2 valid answer-only Noop/local provider responses
- 2 valid safe action-draft responses with `requiresApproval=true`
- 2 invalid JSON/schema responses
- 2 destructive/delete/bulk destructive action proposals
- 2 provider failures/timeouts
- 2 unauthorized cross-user/team/project status/cancel attempts

**Labeling:**
Backend/security reviewer labels pass/fail. PM domain owner reviews that Phase 9 responses do not claim Phase 10-12 tool/write capability.

---

## 6. Guardrails

### Online (Real-Time)

| Guardrail | Trigger | Intervention |
|-----------|---------|--------------|
| Authorization preflight | Invalid team/project/resource or cross-user execution id | Block with existing HTTP error path |
| Output validation | Invalid JSON, invalid DTO, unsafe action draft | Return provider result `status: FAILED`, `OUTPUT_VALIDATION_FAILED` |
| Timeout | Child process exceeds configured timeout | Kill process and record `TIMED_OUT` |
| Cancel | User cancels running execution | Kill process and record `CANCELLED` if first terminal transition |
| Secret redaction | Provider failure includes stdout/stderr/path-like details | Map to redacted provider error title/detail only |

### Offline (Flywheel)

| Metric | Sampling Strategy | Action on Degradation |
|--------|------------------|-----------------------|
| Provider error type counts | Aggregate metadata-only audit rows by `errorType` | Investigate prompt/provider/runner regression |
| Duration p95 | Audit `durationMs` | Tune timeout or prompt size |
| Output validation failure rate | Audit `OUTPUT_VALIDATION_FAILED` | Improve prompt schema contract or later add correction retry |
| Cancel/timeout race test failures | Unit suite | Block merge |

---

## 7. Production Monitoring

**Tracing Tool:** Metadata-only DB audit table in Phase 9. Arize Phoenix/Langfuse deferred until raw prompt/response retention and redaction policy exist.

**Key Metrics to Track:**
- execution count by provider/status/error type
- durationMs p50/p95
- output validation failure count
- timeout and cancellation counts
- provider availability status distribution

**Alert Thresholds:**
- Any credential-pattern value found in tests or logs blocks release.
- Any cross-user status/cancel access test failure blocks release.
- Output validation failure rate above a configured future threshold should trigger prompt/schema review.

**Smart Sampling Strategy:**
Sample failed executions by metadata only. Do not store raw prompt/context/response in Phase 9.

---

## Checklist

- [x] System type classified
- [x] Critical failure modes identified (>= 3)
- [x] Domain context researched (Section 1b: vertical, stakes, expert criteria, failure modes)
- [x] Regulatory/compliance context identified or explicitly noted as none
- [x] Domain expert roles defined for evaluation involvement
- [x] Framework selected with rationale documented
- [x] Alternatives considered and ruled out
- [x] Framework quick reference written (install, imports, pattern, pitfalls)
- [x] AI systems best practices written (Section 4b: structured output, async, prompt discipline, context)
- [x] Evaluation dimensions grounded in domain rubric ingredients
- [x] Each eval dimension has a concrete rubric
- [x] Eval tooling selected — code-based tests now, external tracing deferred by policy
- [x] Reference dataset spec written (size >= 10, composition + labeling defined)
- [x] CI/CD eval integration specified
- [x] Online guardrails defined
- [x] Production monitoring configured for metadata-only audit
