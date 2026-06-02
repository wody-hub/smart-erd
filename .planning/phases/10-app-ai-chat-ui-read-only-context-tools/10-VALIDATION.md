---
phase: 10
slug: app-ai-chat-ui-read-only-context-tools
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: JUnit/Spring Boot Test via Gradle; Frontend: TypeScript compile + Node unit runner; E2E: Playwright smoke specs |
| **Config file** | Backend `build.gradle`; frontend `client/tsconfig.test.json`, `client/scripts/run-unit-tests.mjs`; E2E `client/playwright.config.ts` |
| **Quick run command** | `./gradlew test --tests "*AiChat*" --tests "*AiReadContext*" && cd client && npm run test:unit` |
| **Full suite command** | `./gradlew test && cd client && npm run build && npm run test:unit` |
| **Estimated runtime** | ~180 seconds for full local suite; targeted backend/frontend checks should stay under ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted backend or frontend command for the touched layer.
- **After every plan wave:** Run `./gradlew test && cd client && npm run test:unit`.
- **Before `$gsd-verify-work`:** Run `./gradlew test && cd client && npm run build && npm run test:unit`, plus the AI drawer Playwright smoke when the local app is running.
- **Max feedback latency:** 180 seconds for automated phase gate feedback.

---

## Threat References

| Ref | Threat | Required Control |
|-----|--------|------------------|
| T10-01 | Prompt injection attempts to bypass project scope | Backend selects read tools; model never receives tool authority or credentials |
| T10-02 | IDOR through forged `teamId`, `projectId`, or `resourceId` | Revalidate authenticated user, team, project, and selected resource before provider execution |
| T10-03 | Sensitive data leakage into prompts, responses, or local storage | Persist/render sanitized summaries only; exclude tokens, cookies, DB credentials, env values, raw tool payloads, and raw provider output |
| T10-04 | Insecure output handling or action-shaped provider output | Accept only Phase 10 read-only answer schema; reject or ignore write/action proposals |
| T10-05 | Excessive agency from chat UI | No write proposal, preview/diff, approval, execution, or destructive project control in Phase 10 |
| T10-06 | Cross-user browser-local conversation bleed | Storage key includes authenticated login/user identifier and clears on explicit new conversation/logout path |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-W0-01 | validation | 0 | AI-CHAT-02, AI-READ-04 | T10-02 | Context resolver denies weak, ambiguous, conflicting, and unauthorized scope before provider execution | backend unit | `./gradlew test --tests "*AiChatContext*"` | ❌ W0 | ⬜ pending |
| 10-W0-02 | validation | 0 | AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04 | T10-01 / T10-02 / T10-03 | Read context service assembles summary-first authorized facts only and never exposes raw payloads | backend unit | `./gradlew test --tests "*AiReadContext*"` | ❌ W0 | ⬜ pending |
| 10-W0-03 | validation | 0 | AI-CHAT-01, AI-CHAT-02, AI-READ-04 | T10-02 / T10-04 / T10-05 | Chat HTTP boundary requires authentication, validates request context, and returns read-only structured response/error contracts | backend MVC | `./gradlew test --tests "*AiChatController*"` | ❌ W0 | ⬜ pending |
| 10-W0-08 | validation | 0 | AI-CHAT-01, AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04 | T10-03 / T10-04 / T10-05 | Chat execution service assembles server facts/source/context/confirmation sections, maps provider answer only to interpretation, and rejects or omits provider actions | backend unit | `./gradlew test --tests "*AiChatExecutionService*"` | ❌ W0 | ⬜ pending |
| 10-W0-04 | validation | 0 | AI-CHAT-01, AI-CHAT-02 | T10-03 / T10-06 | Local chat store persists route-independent presentation state only and resets only through explicit new conversation/logout handling | frontend unit | `cd client && npm run test:unit` | ❌ W0 | ⬜ pending |
| 10-W0-05 | validation | 0 | AI-CHAT-02 | T10-02 | Frontend context resolver derives route scope, blocks weak-context questions, and records send-time context without rewriting prior messages | frontend unit | `cd client && npm run test:unit` | ❌ W0 | ⬜ pending |
| 10-W0-06 | validation | 0 | AI-CHAT-01, AI-READ-01, AI-READ-02, AI-READ-03 | T10-04 / T10-05 | Answer card separates conclusion, source chips, confirmed facts, interpretation, and confirmation needs without action UI | frontend unit | `cd client && npm run test:unit` | ❌ W0 | ⬜ pending |
| 10-W0-07 | validation | 0 | AI-CHAT-01, AI-CHAT-02 | T10-03 / T10-05 | Authenticated global drawer opens from app shell, survives route changes, submits one question, and renders a structured answer/error card | e2e smoke | `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java` - covers AI-CHAT-02 and T10-02 weak, ambiguous, conflicting, and unauthorized scope.
- [ ] `src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java` - covers AI-READ-01 through AI-READ-04 and T10-01/T10-03 summary-only data assembly.
- [ ] `src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java` - covers server-side chat section assembly, existing provider-output validation, provider-answer-to-interpretation mapping, server-generated conclusion/needs-confirmation, and provider action rejection/omission.
- [ ] `src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java` - covers AI-CHAT-01, AI-CHAT-02, authenticated chat endpoint, provider failure, and denial paths.
- [ ] `client/test/unit/ai-chat-store.test.ts` - covers route-independent persistence, explicit reset, logout clearing behavior, retention cap, and no-secret persistence.
- [ ] `client/test/unit/ai-chat-context.test.ts` - covers route-derived context, manual override, weak-context requirement, and ambiguous project confirmation state.
- [ ] `client/test/unit/ai-chat-response-cards.test.ts` - covers confirmed facts, interpretation, needs confirmation, source chips, and absence of action proposal controls.
- [ ] `client/e2e/smoke/ai-chat-drawer.spec.ts` - covers authenticated drawer open, route-change persistence, one submit lifecycle, and answer/error card visibility.

---

## Requirement Coverage

| Requirement | Automated Coverage | Manual/E2E Coverage | Required Evidence |
|-------------|--------------------|---------------------|-------------------|
| AI-CHAT-01 | `AiChatControllerMvcTest`, `AiChatExecutionServiceTest`, `ai-chat-store.test.ts`, `ai-chat-response-cards.test.ts` | `ai-chat-drawer.spec.ts` | Chat drawer can send a question and render response/error state |
| AI-CHAT-02 | `AiChatContextResolverTest`, `ai-chat-context.test.ts` | `ai-chat-drawer.spec.ts` | Route context, manual context, weak-context blocking, and ambiguous confirmation are observable |
| AI-READ-01 | `AiReadContextServiceTest`, `AiChatExecutionServiceTest` | Optional seeded-data smoke | Business overview/project summary facts appear in source-backed answer |
| AI-READ-02 | `AiReadContextServiceTest`, `AiChatExecutionServiceTest` | Optional seeded-data smoke | WBS/milestone counts, status, risk, and delay summaries are source-backed |
| AI-READ-03 | `AiReadContextServiceTest`, `AiChatExecutionServiceTest` | Optional seeded-data smoke | Issues, own TODOs, authorized member TODO summaries, and recent history/comment summaries are question-selected |
| AI-READ-04 | `AiChatContextResolverTest`, `AiReadContextServiceTest`, `AiChatControllerMvcTest` | Unauthorized-scope browser smoke if feasible | Cross-team/project/resource/TODO-owner reads are denied before provider execution |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final drawer visual fit across desktop and mobile | AI-CHAT-01, AI-CHAT-02 | Existing Playwright smoke can prove behavior, but final spacing/focus/overflow quality still needs visual inspection | Open authenticated app at desktop and mobile widths; verify right drawer width, fixed header/context/composer, transcript scrolling, wrapped source chips, and no overlapping text |
| Provider unavailable UX with real local runtime disabled | AI-CHAT-01 | Unit tests can mock unavailable status, but final integration should be inspected against actual backend provider state | Start backend with unavailable provider or invalid Codex path; verify send is disabled and localized error/status copy is shown |

---

## Validation Sign-Off

- [x] All requirements have automated verify targets or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive implementation tasks may proceed without an automated verification command.
- [x] Wave 0 covers all currently missing test references.
- [x] No watch-mode flags are used in validation commands.
- [x] Feedback latency target is less than 180 seconds for the full phase gate.
- [x] `nyquist_compliant: true` is set in frontmatter.

**Approval:** pending execution evidence.
