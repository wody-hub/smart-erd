# Phase 6 Nyquist Audit: 간트 차트

**Date:** 2026-04-16  
**Checker:** smt-pm-opus  
**Initial Verdict:** FLAG  
**Final QA Nyquist Verdict:** PASS

## Scope

- Plan: `.planning/phases/06-간트-차트/06-01-PLAN.md`
- Verification: `.planning/phases/06-간트-차트/06-VERIFICATION.md`
- Integration Check: `.planning/phases/06-간트-차트/06-INTEGRATION-CHECK.md`
- UI Review: `.planning/phases/06-간트-차트/06-UI-REVIEW.md`
- Implementation:
  - `client/src/pages/diagram/DiagramsPage.tsx`
  - `client/src/components/gantt/GanttTab.tsx`
  - `client/src/components/gantt/gantt-adapter.ts`
  - `client/src/components/gantt/gantt-update-guards.ts`
  - `client/src/components/ui/tabs.tsx`
  - `client/test/unit/gantt-adapter.test.ts`
  - `client/test/unit/gantt-update-guards.test.ts`

## Nyquist Verdict

Phase 6 functionality appears implemented and previously verified, but the current automated validation depth is weaker than the risk surface of the feature. This audit flags the gap between what the gantt feature can do in production and what is directly protected by reliable automated checks.

This is a verification-depth `FLAG`, not a claim that the shipped gantt behavior is currently broken.

## High-Signal Findings

### 1. Primary unit-test entrypoint is not a trustworthy gate

- `client/package.json` currently defines `test:unit` as `node --test .tmp-test/test/unit` after compilation and alias rewriting.
- The current verification artifacts already show that this command is environment-sensitive and can fail by treating `.tmp-test/test/unit` as a module path instead of a test-file set.
- Equivalent direct compiled execution succeeds:
  - `cd client && node --test .tmp-test/test/unit/*.test.js` -> PASS (`308/308`)

Why this matters:
- The main regression gate exposed to engineers is not the same thing as the command that actually gives a stable pass signal.
- A flaky or path-sensitive entrypoint reduces confidence in future regressions because teams may stop trusting the default test command.

### 2. Automated coverage is concentrated in adapters and guards, not in the highest-risk user flows

Current automated coverage does protect:

- date-only parsing/formatting semantics
- WBS/milestone -> SVAR task projection
- omitted undated leaf behavior
- WBS ordering before milestone append
- finalized date-range guard logic

Coverage does **not** directly protect:

- `DiagramsPage` gantt-tab integration and hero/context branching
- `GanttTab` load/error/retry rendering
- read-only behavior and hint rendering
- the small-screen `columns = []` treatment plus scrollable tab rail contract
- live `drag-task` / `update-task` event flow against the rendered SVAR surface
- query invalidation side effects after a successful persisted drag update

Why this matters:
- The riskiest regressions in Phase 6 are integration regressions around a third-party gantt surface, not pure data-shaping mistakes.
- Current unit coverage is strong at the logic layer but thin at the actual interaction boundary where previous follow-up fixes were needed.

### 3. DOM-coupled milestone styling still has no automated tripwire

- Delayed milestone styling relies on `setID()`, DOM querying, and `MutationObserver` in `client/src/components/gantt/GanttTab.tsx`.
- That behavior was acceptable for delivery, but there is still no automated check that would fail if SVAR changed the relevant DOM structure.

Why this matters:
- This is exactly the sort of visually important integration that can silently degrade after a library update.

## Evidence

- `cd client && npm run build` -> PASS
- `cd client && node --test .tmp-test/test/unit/*.test.js` -> PASS (`308/308`)
- `client/test/unit/gantt-adapter.test.ts` covers adapter/date semantics
- `client/test/unit/gantt-update-guards.test.ts` covers finalized-date guard logic
- `rg -n "gantt|GanttTab|DiagramsPage" client/test client/src --glob '!client/src/components/gantt/*'` shows no component-level or page-level gantt test coverage outside those unit files

## Recommended Follow-Up

1. Fix `client/package.json` so `npm run test:unit` invokes the compiled test files explicitly and matches the command that already passes reliably.
2. Add at least one automated integration-level check for the highest-risk gantt flows:
   - read-only vs editable rendering
   - load/error/retry state wiring
   - small-screen first-view treatment
3. Add one targeted regression check around the persisted drag-update path or around the DOM-dependent delayed milestone styling hook.

## Official QA Outcome

The official Nyquist pass in `.planning/phases/06-간트-차트/06-VALIDATION.md` supersedes this initial local concern. That pass revalidated the risk areas on current head and concluded:

- **PASS** for drag persistence, mobile first view, and load/error/read-only state coverage
- non-blocking confidence gaps remain in Playwright breadth and component-level gantt integration tests
- `npm run test:unit` path brittleness is tooling debt, not a Phase 6 feature blocker

## Initial Conclusion

**FLAG**

Phase 6 probably ships the intended behavior, but the current validation signal is not yet proportionate to the most failure-prone parts of the feature. The feature logic is covered better than the live gantt integration boundary.
