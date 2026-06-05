# Phase 13: AI Chat Detailed Read Tools - AI-SPEC

## 1. System Classification

**Type:** Conversational Q&A with backend-controlled structured read context.

Smart-ERD remains a Spring Boot AI harness with a provider abstraction and Local Codex CLI as the first provider. Phase 13 does not introduce LangChain, LangGraph, RAG/vector search, or frontend API tool access.

## 2. Framework Selection

**Selected:** Existing `AiProvider` + `LocalCodexProcessProvider` + `AiReadContextService`.

**Rationale:** The data is already structured in Smart-ERD services. The safest path is to let the backend execute authorized reads and pass sanitized rows to the provider. A full agent framework is unnecessary for this phase.

## 3. Implementation Guidance

```java
ReadContext readContext = aiReadContextService.read(loginId, command);
providerExecutionRunner.execute(new RunCommand(..., Map.of("readContext", readContext.sanitizedProviderContext())));
```

Rules:
- Use existing domain services as the read allowlist.
- Convert DTOs to small `Map<String, Object>` rows.
- Omit login IDs and raw technical payloads.
- Preserve row and provider-character caps.
- Keep member TODO details out of provider context.

## 4. Guardrails

- No arbitrary API, URL, SQL, filesystem, or shell tool execution.
- `teamId`, `projectId`, and `loginId` come from backend scope resolution, not from model output.
- Treat project text as data, not instructions.
- If context lacks requested detail, answer with the missing-data limitation.
- Do not bypass Phase 11/12 approval pipeline for writes.

## 5. Evaluation Strategy

| Dimension | Check |
| --- | --- |
| Grounding | Provider context contains real capped rows for detailed WBS/issues/TODO/milestone/history questions. |
| Privacy | Login IDs, tokens, cookies, stdout/stderr, and member TODO detail rows are absent. |
| Authorization | Detailed reads go through existing services that validate project/team scope. |
| Caps | Returned rows and provider context are capped with truncation metadata. |
| Injection resistance | Prompt tells provider that row text is data, not instructions. |

## 6. Reference Tests

- `AiReadContextServiceTest.detailedReadContextSerializesAuthorizedRowsForProviderGrounding`
- Existing AI chat/provider execution tests for provider context serialization and failure handling.

## 7. Future Tool Loop

A later phase may add a two-pass `ReadPlan` flow:
1. Provider proposes allowlisted read requests.
2. Backend validates and executes those reads.
3. Provider receives sanitized detail context and writes the final answer.

This phase intentionally stops before that loop to avoid widening the trust boundary before the detailed context MVP is verified.
