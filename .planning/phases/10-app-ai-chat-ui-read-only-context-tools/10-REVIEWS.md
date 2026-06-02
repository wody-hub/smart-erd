---
phase: 10
reviewers: [codex]
reviewed_at: 2026-06-02T05:47:37Z
plans_reviewed:
  - 10-01-PLAN.md
  - 10-02-PLAN.md
  - 10-03-PLAN.md
  - 10-04-PLAN.md
  - 10-05-PLAN.md
  - 10-06-PLAN.md
  - 10-07-PLAN.md
cycle: 1
max_cycles: 3
current_high_unresolved: 8
---

# Cross-AI Plan Review - Phase 10

## Codex Review

## Summary

The plan set is strong and mostly phase-complete. It respects the core safety boundary: frontend never runs Codex, backend owns scope/read authorization, Phase 10 stays read-only, and source chips/facts come from server-read data. The main risks are not conceptual. They are execution-contract risks: synchronous chat vs cancel UI, ambiguous reuse of `AiExecutionGateway`, login-scoped local persistence mechanics, and read-context fanout/performance.

Overall risk: **MEDIUM-HIGH** until those contracts are tightened.

## 10-01-PLAN.md

### Strengths

- Good Wave 0 posture. It forces auth, scope, privacy, read-only, and UI contracts before implementation.
- Covers backend, frontend unit, and Playwright smoke.
- Explicitly blocks Phase 11/12 write/proposal scope from leaking into Phase 10.

### Concerns

- **HIGH:** Tests target exact production class names before skeletons exist. Gradle/TS compilation may fail as setup noise, not useful RED behavior.
- **MEDIUM:** Several references use the wrong `ProviderOutputValidator` package. It currently lives under `com.smarterd.application.ai.validation`.
- **LOW:** Backend task text says "three files compile" while creating four backend files.

### Suggestions

- Add minimal production skeletons in Wave 0, or state clearly that compile failure is acceptable until 10-02/10-03.
- Fix `ProviderOutputValidator` references.
- Extract/reuse a test JWT resolver helper instead of duplicating private inner classes.

### Risk Assessment

**MEDIUM.** Good validation strategy, but brittle RED setup can slow every later plan.

## 10-02-PLAN.md

### Strengths

- Correctly makes backend scope resolution authoritative.
- Strong TODO privacy stance: own TODOs by default, member summaries only when explicit.
- Source chips are tied to actual read results, not model prose.

### Concerns

- **HIGH:** Multi-project read context can become N+1 and too large. No explicit caps for projects, WBS rows, issue rows, history rows, or provider-context size.
- **HIGH:** Misspelled/ambiguous project matching is unspecified. Fuzzy scope logic without deterministic thresholds is a future bug.
- **MEDIUM:** "Existing authorization permits member TODO summary" is too broad. It needs a concrete role/policy rule.
- **MEDIUM:** Keyword-based tool selection may miss Korean phrasing and SI PM synonyms.

### Suggestions

- Define hard caps: max projects per team query, max recent history rows, max detailed items, max provider context bytes.
- Use typed read summary records instead of loose `Map<String,Object>` where possible.
- Make project-name matching deterministic: exact, normalized exact, contains, then confirmation. Avoid silent fuzzy guesses.
- Add role-specific tests for member TODO summary visibility.

### Risk Assessment

**MEDIUM-HIGH.** Security boundary is good, but data-volume and matching rules need sharper contracts.

## 10-03-PLAN.md

### Strengths

- Clean separation between product chat API and Phase 9 provider API.
- Correct ordering: resolve scope, build read context, then provider.
- Keeps Phase 9 provider schema intact and assembles chat sections server-side.

### Concerns

- **HIGH:** Provider execution strategy is undecided. "Use `AiExecutionGateway` if possible, otherwise inject provider/registry" is too vague for a core path. Current `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java` assumes a single `teamId/projectId` and builds its own sanitized context, which does not naturally support multi-project chat facts.
- **HIGH:** Cancel lifecycle conflicts with synchronous `POST /api/ai/chat`. If the frontend only receives `executionId` after the request completes, "cancel running" cannot cancel the running provider call.
- **MEDIUM:** Non-empty provider actions should be an explicit validation failure or redacted chat failure, not silently omitted.

### Suggestions

- Decide the gateway shape now. Best option: extract a lower-level provider execution runner shared by Phase 9 and chat, while chat owns scope/read assembly.
- Either make chat async with start/status/cancel, or remove cancel-running from Phase 10 UI. Do not pretend synchronous HTTP supports server-side cancellation.
- Add a test proving provider action drafts produce a safe read-only failure marker.

### Risk Assessment

**HIGH.** This is the main architectural risk in the set.

## 10-04-PLAN.md

### Strengths

- Good client boundary: route context is only a hint.
- Login-scoped persistence and 50-message cap are the right constraints.
- Explicitly avoids raw provider/read payload persistence.

### Concerns

- **HIGH:** Zustand `persist` with a login-scoped key is tricky because the key is often static at store creation. User switching can still bleed state unless the storage adapter or hydration logic is deliberate.
- **MEDIUM:** Logout clearing is planned, but existing auth logout does not automatically know about future AI chat keys.
- **LOW:** Regex-based forbidden-field checks can false-positive on comments/imports and miss nested unsafe data.

### Suggestions

- Implement an explicit per-login storage adapter or manual load/save keyed by `STORAGE_KEYS.AI_CHAT_CONVERSATION_PREFIX + loginId`.
- Wire chat namespace cleanup into logout/user-switch behavior.
- Test the serialized storage payload directly, not just source text.

### Risk Assessment

**MEDIUM.** Good intent, but local persistence is easy to get subtly wrong.

## 10-05-PLAN.md

### Strengths

- Correctly centralizes `/ai/chat` access in one typed API module.
- React Query + store normalization is the right client pattern.
- Confirmation candidates flow from backend response into UI state.

### Concerns

- **HIGH:** Same cancel problem as 10-03. `cancelRunning` needs an execution ID while the chat request is still in flight.
- **MEDIUM:** 10-05 does not depend on 10-03, but it relies on `AiChatResponse` fields defined there. Parallel implementation can drift.
- **MEDIUM:** Unit coverage is underspecified for API response normalization and failure states.

### Suggestions

- Add dependency on 10-03, or create a shared contract fixture before both plans proceed.
- Define whether cancel means HTTP abort only or provider cancellation. If provider cancellation, chat must become async.
- Add tests for confirmation response, provider-safe failure, auth failure, and stale/running execution behavior.

### Risk Assessment

**MEDIUM-HIGH.** Mostly sound, blocked by the cancel/API contract.

## 10-06-PLAN.md

### Strengths

- Good component decomposition: context bar, composer, answer card, source chips.
- Localized copy and no write/action controls are correctly enforced.
- Manual context uses authorized team/project APIs, not AI read tools.

### Concerns

- **MEDIUM:** "Work-report tone" cannot be guaranteed by UI components alone. Backend prompt/assembler behavior must own most of that.
- **MEDIUM:** No visual/mobile verification until 10-07, despite dense drawer UI and chip wrapping risks.
- **LOW:** Node-only component tests may be weak if they do not actually render TSX output.

### Suggestions

- Add render-to-static-markup or equivalent tests for `AiAnswerCard` section order and absence of controls.
- Add a mobile/wide viewport smoke check for chip wrapping and composer layout in 10-07.
- Move tone guarantees into backend prompt/assembler tests, not only UI acceptance text.

### Risk Assessment

**MEDIUM.** UI plan is good, but needs stronger layout verification.

## 10-07-PLAN.md

### Strengths

- Correct final integration: global authenticated drawer, header trigger, route-independent host.
- Keeps provider status badge separate from chat trigger.
- Final verification includes build, unit, backend, grep, and Playwright smoke.

### Concerns

- **HIGH:** Header trigger availability assumes every authenticated screen renders `Header`. The drawer host can be global, but opening it may not be.
- **HIGH:** Playwright smoke depends on "real or safely mocked/noop provider" but does not define the backend/provider setup. This can become flaky.
- **MEDIUM:** Auth gating by local access token can briefly render stale authenticated UI before validation.
- **MEDIUM:** Source chips must be message snapshots from send-time response context. The final smoke should explicitly test they do not change after route/context changes.

### Suggestions

- Add a test or audit that every protected route has access to the trigger, or mount a global trigger in the app shell.
- Define a deterministic E2E provider mode: noop expected error card or mocked `/api/ai/chat` response.
- Add Playwright checks for route change while drawer stays open, source chip immutability, and weak-context send disabled state.

### Risk Assessment

**MEDIUM.** Integration is clear, but E2E determinism and global trigger coverage need tightening.

## Overall Suggestions

- Decide the chat execution model before implementation: synchronous no-cancel, or async start/status/cancel. Current plans mix both.
- Refactor or extend the Phase 9 provider boundary explicitly. Do not duplicate gateway internals ad hoc.
- Add read-context caps and typed summary DTOs before provider prompting.
- Fix the `ProviderOutputValidator` package references in plans.
- Make local persistence serialization a first-class tested function.

## Overall Risk Assessment

**MEDIUM-HIGH.** The plan achieves the phase goals on paper and has strong security instincts. The remaining risks are concentrated in a few contracts that affect multiple waves: provider gateway reuse, cancellation semantics, read-context size, and user-scoped persistence. Tighten those now and the rest of the phase looks executable.

---

## Consensus Summary

Only the Codex reviewer was requested for this cycle, so this section synthesizes recurring themes within that review instead of cross-reviewer agreement.

### Agreed Strengths

- Phase 10 maintains the intended read-only boundary: frontend does not execute Codex, backend owns authorization, and write/action proposal scope is kept for later phases.
- The wave structure is mostly coherent: backend scope/read services precede chat orchestration, frontend API and UI follow, and final verification closes with drawer integration and smoke checks.
- Source chips and fact/inference separation are well-aligned with the requirement that answers be grounded in authorized project data.

### Agreed Concerns

- **HIGH:** Chat execution and cancellation semantics are inconsistent across 10-03 and 10-05. The plans must choose synchronous no-cancel behavior or an async start/status/cancel API before implementation.
- **HIGH:** Provider boundary reuse is under-specified. Chat should not duplicate `AiExecutionGateway` internals, but the current gateway shape does not naturally support multi-project chat context.
- **HIGH:** Read context needs hard caps and deterministic matching rules before provider prompting, or multi-project queries can become expensive and ambiguous.
- **HIGH:** Local persistence needs deliberate per-login storage mechanics to avoid cross-user conversation bleed.
- **HIGH:** Final E2E provider behavior must be deterministic, or Phase 10 smoke coverage can become flaky and fail to prove the drawer workflow.

### Divergent Views

- No divergent reviewer views were available because this cycle used a single requested reviewer (`--codex`).
- The reviewer judged the overall plan set as executable after contract tightening, while identifying 10-03 as the highest architectural risk.

## Current HIGH Concerns

- 10-01 validation tests reference exact production class names before skeletons exist, creating compile-noise risk instead of useful RED behavior.
- 10-02 read context lacks caps for project fanout, row counts, recent history, and provider-context size.
- 10-02 project-name matching does not define deterministic handling for misspellings or ambiguous fuzzy matches.
- 10-03 provider execution strategy is undecided; current `AiExecutionGateway` assumptions do not fit multi-project chat facts cleanly.
- 10-03/10-05 cancellation semantics conflict with synchronous `POST /api/ai/chat`, so running provider calls cannot be cancelled as planned.
- 10-04 login-scoped Zustand persistence may use a static key and leak state across user switches unless storage/hydration is explicit.
- 10-07 AI drawer trigger availability assumes every authenticated screen renders `Header`, which may leave some protected routes without an opener.
- 10-07 Playwright smoke depends on an undefined real/mocked/noop provider setup, making final verification potentially flaky.

## Cycle Summary

CYCLE_SUMMARY: current_high=8
