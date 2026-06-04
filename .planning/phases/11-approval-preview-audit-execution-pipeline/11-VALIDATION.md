---
phase: 11
slug: approval-preview-audit-execution-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-04
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JUnit 5 + Spring MVC tests, Node test runner for frontend unit tests |
| **Config file** | `build.gradle`, `client/package.json`, `client/tsconfig.test.json` |
| **Quick run command** | `./gradlew test --tests '*Ai*'` |
| **Frontend quick command** | `cd client && npm run test:unit -- ai-chat-response-cards ai-chat-store ai-chat-api ai-chat-execution` |
| **Full suite command** | `./gradlew test && cd client && npm run test:unit` |
| **Estimated runtime** | ~120-240 seconds |

---

## Sampling Rate

- **After every backend task commit:** Run the most specific `./gradlew test --tests '<ClassName>'` command for touched AI/proposal classes.
- **After every frontend task commit:** Run the specific `client` unit tests covering touched AI chat/store/API components.
- **After every plan wave:** Run `./gradlew test --tests '*Ai*'` and the frontend quick command.
- **Before `$gsd-verify-work`:** Run `./gradlew test && cd client && npm run test:unit`.
- **Max feedback latency:** 4 minutes for wave-level verification.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | AI-ACT-01, AI-AUD-01, AI-AUD-02 | T-11-01 | provider actions persist as sanitized proposals, not raw payload/browser state | unit/integration | `./gradlew test --tests '*AiActionProposal*' --tests '*AiChat*'` | ✅ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | AI-APP-01, AI-APP-02, AI-APP-03 | T-11-02 | approve/cancel transitions are idempotent and unsupported actions cannot mutate | unit/integration | `./gradlew test --tests '*AiActionProposal*'` | ✅ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | AI-AUD-01, AI-AUD-02, AI-AUD-03 | T-11-03 | history exposes redacted execution/proposal/decision metadata only | MVC/integration | `./gradlew test --tests '*Ai*History*' --tests '*Ai*Audit*'` | ✅ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | AI-ACT-01, AI-APP-01, AI-APP-02 | T-11-04 | proposal cards show summary/target/diff/risk and hide raw payload | frontend unit | `cd client && npm run test:unit -- ai-chat-response-cards ai-chat-store ai-chat-api ai-chat-execution` | ✅ W0 | ⬜ pending |
| 11-05-01 | 05 | 3 | AI-ACT-01, AI-APP-01, AI-APP-02, AI-APP-03, AI-AUD-01, AI-AUD-02, AI-AUD-03 | T-11-05 | cross-cutting regression confirms Phase 12 handoff without enabling concrete writes | mixed | `./gradlew test --tests '*Ai*' && cd client && npm run test:unit -- ai-chat-response-cards ai-chat-store ai-chat-api ai-chat-execution` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Threat References

| Threat | Description | Blocking Severity |
|--------|-------------|-------------------|
| T-11-01 | Raw provider payload, prompt, context, stdout/stderr, tokens, cookies, or env values leak into DB, response DTO, logs, or browser local storage | high |
| T-11-02 | Approval endpoint mutates data without revalidating authorization, stale state, action type, target scope, and executor support | high |
| T-11-03 | Project AI history leaks another project/user/private TODO proposal detail | high |
| T-11-04 | Frontend renders or persists raw implementation payload instead of sanitized proposal preview | high |
| T-11-05 | Phase 11 accidentally enables concrete issue/TODO/WBS writes before Phase 12 executor registration | high |

---

## Wave 0 Requirements

Existing infrastructure covers Phase 11 requirements:

- `src/test/java/com/smarterd/application/ai/ActionDraftValidatorTest.java`
- `src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java`
- `src/test/java/com/smarterd/application/ai/AiExecutionAuditServiceTest.java`
- `src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java`
- `client/test/unit/ai-chat-response-cards.test.ts`
- `client/test/unit/ai-chat-store.test.ts`
- `client/test/unit/ai-chat-api.test.ts`
- `client/test/unit/ai-chat-execution.test.ts`

No new test framework is required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Proposal card state survives route changes | AI-APP-02 | Requires visual drawer state and navigation behavior | Open AI drawer, show a proposal card, cancel or approve it, navigate to another route, return, and verify the card remains attached to the original answer with terminal state |
| Project AI history is readable from project context | AI-AUD-03 | Final placement depends on project UI integration | Open project context, enter AI history surface, verify recent execution/proposal/decision rows and sanitized detail |

---

## Validation Sign-Off

- [x] All tasks have automated verification commands or existing Wave 0 dependencies.
- [x] Sampling continuity has no 3 consecutive tasks without automated verification.
- [x] Existing Wave 0 tests cover the current AI gateway/chat baseline.
- [x] No watch-mode flags are used in required commands.
- [x] Feedback latency target is under 4 minutes for wave-level verification.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution
