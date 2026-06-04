---
phase: 12-low-risk-write-tools-mvp
status: complete
reviewed_at: 2026-06-04
threats_open: 0
---

# Phase 12 Security Review

## Trust Boundaries

| Boundary | Decision |
|----------|----------|
| Browser approval to backend | Browser sends only `proposalId`; executor input comes from persisted sanitized proposal JSON. |
| AI payload to write service | `AiActionPayloadReader` allowlists action fields and rejects unknown or invalid values. |
| Proposal executor to domain mutation | Executors call existing Smart-ERD services, not repositories or direct SQL. |
| Execution result to UI/history | Result metadata is typed and compact; raw JSON is not exposed through DTOs. |

## STRIDE Register

| Threat | Severity | Status | Mitigation | Evidence |
|--------|----------|--------|------------|----------|
| Authorization bypass on issue/TODO/WBS writes | High | Closed | Executors call `ProjectIssueService`, `ProjectTodoService`, and `WorkItemHistoryService` with approver login and proposal team/project ids. | Executor tests, `./gradlew test` |
| Payload tampering or field escalation | High | Closed | Shared reader rejects unknown fields and wrong target types. | `AiActionPayloadReaderTest`, executor unknown-field tests |
| Stale update mutation | High | Closed | Optional `beforeValue` is compared to current server state before update. | Issue/TODO stale tests |
| Private TODO mutation | High | Closed | TODO executor never accepts owner id and uses requester-owned service methods. | `TodoActionExecutorTest` |
| Destructive action execution | High | Closed | Only exact six low-risk action types have executors; delete/bulk/shell/sql remain unsupported by validator/registry. | `AiActionProposalServiceTest`, registry behavior |
| Result/privacy leakage | Medium | Closed | DTO exposes typed result metadata only; raw result JSON remains internal. | frontend tests, raw-key scan |
| Repudiation/audit gap | Medium | Closed | Phase 11 proposal decision audit remains in service path; Phase 12 stores compact result summary for executed terminal state. | `./gradlew test` |

## Raw-Key Scan

Command:

```bash
rg "rawPrompt|rawContext|rawProviderOutput|stdout|stderr|accessToken|refreshToken|cookie|password|SMART_ERD_|SPRING_|env" src/main/java/com/smarterd/application/ai/proposal src/main/java/com/smarterd/api/ai client/src/components/ai client/src/stores/useAiChatStore.ts
```

Result: only the sanitizer denylist matched (`cookie`, `password`, `env`, `stdout`, `stderr`). No DTO/UI/store exposure found.
