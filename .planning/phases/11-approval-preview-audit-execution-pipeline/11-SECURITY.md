---
phase: 11
slug: approval-preview-audit-execution-pipeline
status: verified
asvs_level: 1
threats_total: 21
threats_mitigated: 16
threats_accepted: 5
threats_open: 0
created: 2026-06-04
verified: 2026-06-04T06:08:00Z
---

# Phase 11 Security Verification

Phase 11 converts AI write intent into persisted, reviewable, sanitized proposals. The security goal is explicit: no AI-proposed mutation can execute from raw provider output, hidden browser payload, or stale project authorization.

## Scope

Reviewed the Phase 11 plans, implementation summaries, code-review report, and final verification evidence for:

- Proposal persistence and lifecycle state transitions.
- Sanitized proposal preview DTOs, chat cards, local storage, and project AI history rows.
- Approve/cancel endpoints and server-side authorization.
- Empty Phase 11 executor boundary before Phase 12 concrete mutations.
- Audit metadata and redacted error/result handling.

## Trust Boundaries

| Boundary | Direction | Security Requirement | Status |
|---|---|---|---|
| AI provider action draft -> proposal service | External/LLM output into backend domain | Whitelist allowed proposal fields and drop raw prompt/context/provider/stdout/stderr/secrets. | verified |
| Proposal entity -> browser DTO/UI/local storage | Backend domain into browser-visible state | Expose only sanitized proposal card fields and server-owned preview data. | verified |
| Browser decision -> proposal service/executor registry | Browser intent into backend mutation path | Accept proposal id only; reload persisted proposal and revalidate project access/status/executor support. | verified |
| Project route -> AI history query | Authenticated project context into history reads | Authorize project before repository reads and hide personal TODO details when not visible. | verified |
| History API -> project tab | Backend audit rows into project UI | Render read-only sanitized metadata without approve/cancel controls or raw payloads. | verified |
| Phase 11 -> Phase 12 executor handoff | Current non-mutating phase into future mutation phase | Keep production executor registry empty and document exact future extension points. | verified |

## Threat Register

| Threat ID | Category | Severity | Disposition | Verification Result |
|---|---|---|---|---|
| T-11-01-01 | Information Disclosure | High | mitigate | Closed. Proposal sanitizer/entity and DTO path use allowlisted fields; raw-key exposure scan returned no matches outside sanitizer deny-list declarations. |
| T-11-01-02 | Tampering | High | mitigate | Closed. Proposal service tests cover `PENDING`-only transitions and idempotent terminal approve/cancel behavior. |
| T-11-01-03 | Elevation of Privilege | High | mitigate | Closed. Production executor registry remains empty; unsupported approvals reject without mutation. |
| T-11-01-SC | Tampering | Low | accept | Closed as accepted supply-chain risk. No Java or npm dependency is introduced by this plan. |
| T-11-02-01 | Information Disclosure | High | mitigate | Closed. Chat response maps server proposal views only and tests cover absent raw keys. |
| T-11-02-02 | Tampering | High | mitigate | Closed. Approve/cancel APIs accept proposal id only and reload persisted server state. |
| T-11-02-03 | Elevation of Privilege | High | mitigate | Closed. Approval service revalidates project access, proposal state, action type, and executor support before execution. |
| T-11-02-04 | Repudiation | Medium | mitigate | Closed. Decision, reject, fail, expire, and cancel paths write audit metadata with actor and terminal status. |
| T-11-02-SC | Tampering | Low | accept | Closed as accepted supply-chain risk. No package-manager install was used. |
| T-11-03-01 | Information Disclosure | High | mitigate | Closed. Project AI history authorizes project access before repository reads and returns whitelisted response fields. |
| T-11-03-02 | Information Disclosure | High | mitigate | Closed. Personal TODO proposal details are hidden from non-owner/non-requester unless project-visible through WBS context. |
| T-11-03-03 | Repudiation | Medium | mitigate | Closed. History rows expose requester, decision actor, status, execution id, proposal id, and timestamps. |
| T-11-03-SC | Tampering | Low | accept | Closed as accepted supply-chain risk. No dependency changes were planned or introduced. |
| T-11-04-01 | Information Disclosure | High | mitigate | Closed. Proposal card rendering consumes typed sanitized fields only; frontend raw-key tests passed. |
| T-11-04-02 | Tampering | High | mitigate | Closed. Frontend API helpers send only proposal id to decision endpoints. |
| T-11-04-03 | Information Disclosure | High | mitigate | Closed. Zustand persistence sanitizer whitelists proposal card fields and strips raw/secret keys. |
| T-11-04-SC | Tampering | Low | accept | Closed as accepted supply-chain risk. Existing React, React Query, Zustand, UI primitives, and lucide dependencies were reused. |
| T-11-05-01 | Information Disclosure | High | mitigate | Closed. Project AI history tab renders sanitized history fields only and exposes no mutation controls. |
| T-11-05-02 | Elevation of Privilege | High | mitigate | Closed. Phase 12 handoff documents executor extension points; Phase 11 has no production executor implementation. |
| T-11-05-03 | Information Disclosure | High | mitigate | Closed. Backend/frontend raw-key scans and storage tests passed before closeout. |
| T-11-05-SC | Tampering | Low | accept | Closed as accepted supply-chain risk. Existing dependencies only. |

## Evidence

| Control | Evidence | Result |
|---|---|---|
| Proposal lifecycle and authorization | `./gradlew test --tests "*AiActionProposal*" --tests "*AiChat*" --tests "*AiProjectHistory*" --tests "*Ai*Audit*"` | pass |
| Full backend checks | `./gradlew check` | pass |
| Frontend proposal/history behavior | `cd client && npm run test:unit -- ai-chat-response-cards ai-chat-store ai-chat-api ai-chat-execution ai-history-api project-workspace-tab-order project-ai-history-tab` | pass, 408/408 |
| Frontend production build | `cd client && npm run build` | pass |
| Raw exposure path | `rg "rawPrompt|rawContext|rawProviderOutput|stdout|stderr|accessToken|refreshToken|cookie|password|SMART_ERD_|SPRING_|env" ... --glob '!**/AiActionProposalSanitizer.java'` | no matches |
| Executor boundary | `rg "implements AiActionExecutor" src/main/java/com/smarterd` | no matches |
| AI mutation bypass | `rg "\.(createProjectIssue|updateProjectIssue|createProjectTodo|updateProjectTodo|addWbsComment)\(" src/main/java/com/smarterd/application/ai` | no matches |
| Review-time critical fix | `11-REVIEW.md`, commit `dfb7800` | project access revalidation added before get/approve/cancel |

## Accepted Risks

| Risk ID | Source Threats | Risk | Reason Accepted | Follow-up |
|---|---|---|---|---|
| AR-11-SC | T-11-01-SC, T-11-02-SC, T-11-03-SC, T-11-04-SC, T-11-05-SC | Supply-chain tampering through new packages | Phase 11 introduced no new Java or npm dependencies and reused existing project libraries only. | Re-evaluate in any future phase that changes `build.gradle`, Gradle version catalogs, `client/package.json`, or lockfiles. |

## Security Sign-Off

- [x] All Phase 11 STRIDE threats are closed or explicitly accepted.
- [x] `threats_open` is `0`.
- [x] Approval revalidates project authorization before returning or transitioning proposals.
- [x] No production executor is registered before Phase 12.
- [x] Browser state does not carry raw provider payload, prompt, read context, stdout/stderr, stack traces, token, cookie, password, or environment data.
- [x] Project AI history remains read-only and project-authorized.

Verified by Codex inline security audit on 2026-06-04.
