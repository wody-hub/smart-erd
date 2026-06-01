---
phase: 09
slug: ai-tool-gateway-provider-abstraction
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JUnit 5 + Mockito + MockMvc + TypeScript build |
| **Config file** | `build.gradle`, `client/tsconfig.app.json` |
| **Quick run command** | `./gradlew test --tests "com.smarterd.application.ai.*" --tests "com.smarterd.api.ai.*"` |
| **Full suite command** | `./gradlew test && cd client && npm run build` |
| **Estimated runtime** | backend targeted ~30-60s, full suite environment-dependent |

---

## Sampling Rate

- **After every task commit:** Run the targeted backend AI test command for backend tasks, or `cd client && npm run build` for frontend tasks.
- **After every plan wave:** Run all tests introduced by that wave.
- **Before `$gsd-verify-work`:** `./gradlew test && cd client && npm run build` plus opt-in local Codex smoke where the developer machine supports it.
- **Max feedback latency:** 60 seconds for targeted tests.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | AI-RUN-02 | T-09-01 | Provider abstraction and Noop path avoid UI/domain coupling to Codex | unit | `./gradlew test --tests "com.smarterd.application.ai.*"` | ✅ | ✅ passed |
| 09-01-02 | 01 | 1 | AI-RUN-04 | T-09-02 | Invalid output/action drafts fail closed | unit | `./gradlew test --tests "com.smarterd.application.ai.validation.*"` | ✅ | ✅ passed |
| 09-01-03 | 01 | 1 | AI-SEC-01 | T-09-03 | Audit persists metadata only | unit | `./gradlew test --tests "com.smarterd.domain.ai.*"` | ✅ | ✅ passed |
| 09-01-04 | 01 | 1 | AI-RUN-01/02/04 | T-09-04 | API exposes status/execute/lookup/cancel with existing auth error path | mvc | `./gradlew test --tests "com.smarterd.api.ai.*"` | ✅ | ✅ passed |
| 09-02-01 | 02 | 2 | AI-RUN-03 | T-09-05 | Codex runner uses argv/no shell/temp cwd/sandbox/output schema | unit | `./gradlew test --tests "com.smarterd.application.ai.provider.*"` | ✅ | ✅ passed |
| 09-02-02 | 02 | 2 | AI-SEC-01 | T-09-06 | Child env excludes secrets and broad backend env vars | unit | `./gradlew test --tests "com.smarterd.application.ai.provider.*"` | ✅ | ✅ passed |
| 09-02-03 | 02 | 2 | AI-RUN-04 | T-09-07 | Timeout/cancel/process completion races resolve to one terminal state | unit | `./gradlew test --tests "com.smarterd.application.ai.*"` | ✅ | ✅ passed |
| 09-03-01 | 03 | 3 | AI-RUN-01 | T-09-08 | Frontend maps provider status and displays minimal user-visible status | build | `cd client && npm run build` | ✅ | ✅ passed |
| 09-03-02 | 03 | 3 | AI-RUN-01/02/03/04/AI-SEC-01 | T-09-09 | Full contract is covered before execution handoff | full | `./gradlew test && cd client && npm run build` | ✅ | ✅ passed |

*Status: complete. See `VERIFICATION.md` for command results and residual risks.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- JUnit 5/Mockito/AssertJ already configured.
- MockMvc standalone controller tests already exist.
- Flyway migrations already exist.
- Frontend TypeScript build already exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local Codex happy path | AI-RUN-03 | Depends on the developer machine having Codex CLI installed and logged in | Enable the opt-in smoke flag/profile, run the local Codex smoke, and confirm a structured JSON response |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or explicit manual-only rationale
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing infrastructure references
- [x] No watch-mode flags
- [x] Feedback latency target < 60s for targeted tests
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-01
