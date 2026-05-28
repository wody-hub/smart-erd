---
phase: 3
reviewers: [codex]
reviewed_at: 2026-05-28T06:51:35Z
plans_reviewed:
  - .planning/phases/03-화면기획-플러그인/03-01-PLAN.md
  - .planning/phases/03-화면기획-플러그인/03-02-PLAN.md
  - .planning/phases/03-화면기획-플러그인/03-03-PLAN.md
---

# Cross-AI Plan Review - Phase 3

## Codex Review

### Summary

The plans are directionally strong for a closeout phase: they correctly treat Phase 3 as verification/evidence work, preserve the `DomainValidationHook` no-op decision, require both automated and dev-profile evidence, and prevent marking SPEC-01~04 complete without proof. The main risk is that the proposed E2E scenarios still under-specify some core requirement evidence, especially master definition/update propagation, multi-screen instance placement, and lock/conflict UX. If executed literally, Phase 3 could still fail closeout despite substantial test scaffolding.

### Plan 03-01 Review

#### Strengths

- Good separation of reusable `screen-spec` E2E helpers from the smoke spec.
- Correctly uses existing `pluginId: 'screen-spec'` provisioning path.
- Export validation is much better than UI-click-only testing: filename, file size, PNG magic bytes, PDF signature/structure.
- Passive `data-testid` hooks are constrained and scoped to stable locator needs.
- Includes persistence/re-entry, which is essential for SPEC-01 closeout.

#### Concerns

- **HIGH:** SPEC-01 requires defining master components and placing instances across multiple screens. The plan appears to drag an existing library item onto one canvas, not create/define a new master and place it on multiple screens.
- **HIGH:** SPEC-02 is not actually proven. Changing an instance label override to `Primary CTA` does not verify that editing a master updates all existing instances.
- **MEDIUM:** "Assert instance count changes to 1" may be hard if the canvas is Konva-only and no accessible instance list/count exists.
- **MEDIUM:** PDF "page marker" checks can be brittle. Generated PDFs may compress objects or structure pages differently.
- **LOW:** The plan does not mention fixture cleanup. Unique names reduce collision risk but do not prevent long-term test data buildup.

#### Suggestions

- Add explicit master lifecycle steps:
  - create or define a custom master named `Primary Button ${suffix}`;
  - place it on screen A and screen B;
  - update the master label/color/shape;
  - assert both instances reflect inherited changes.
- Add a direct SPEC-02 assertion in this plan or move SPEC-02 entirely to 03-02.
- Prefer PDF checks of `%PDF`, `%%EOF`, non-empty size, and at least one `/Type /Page` marker if no existing PDF parser is available.
- Add cleanup or document why cleanup is intentionally omitted for E2E auditability.
- Add one negative export assertion if export stage is empty or no screen is selected, if the UI supports that state.

#### Risk Assessment

**MEDIUM.** The export portion is solid, but SPEC-01/SPEC-02 evidence is incomplete unless master creation, multi-screen placement, and master cascade assertions are added.

### Plan 03-02 Review

#### Strengths

- Correctly requires three isolated browser contexts/accounts.
- Correctly treats missing lock/conflict UX as a blocker, not something to paper over in docs.
- Good reuse of the existing markdown three-account collaboration pattern.
- Includes diagnostics collection across all pages.
- Preserves the no-op backend validation hook policy.

#### Concerns

- **HIGH:** The scenario still does not clearly test master update propagation. Owner changes an instance label, but SPEC-02 is about master edits reflecting across instances.
- **HIGH:** D-05 requires master create/update/delete and instance placement/move/resize. The planned scenario covers only part of that flow and does not explicitly include master delete or resize.
- **HIGH:** Lock/conflict verification may require implementation work if runtime state is not exposed. That is acceptable, but the plan should classify it as a SPEC-03 implementation gap, not just an E2E failure.
- **MEDIUM:** "Propagation delay is failure" needs a concrete threshold. The plan has `20_000ms`, but should define whether exceeding that is failure or flaky retry.
- **MEDIUM:** Failing on all browser warnings may make the test noisy if the app has known benign warnings. The filter policy needs to be explicit and narrow.
- **MEDIUM:** Adding collaboration UI in this closeout phase risks scope growth unless the exact required state source already exists.

#### Suggestions

- Make the core collaboration script explicitly cover:
  - owner creates master `Shared CTA`;
  - owner places two instances;
  - member one observes;
  - owner updates master label/color;
  - member one and member two observe both instances update;
  - member two resizes/moves an instance;
  - owner observes changed transform;
  - one user deletes or archives a master and the other users observe expected orphan/rebind/delete behavior.
- Define lock acceptance precisely:
  - expected visible label/text;
  - whether failed edit reverts immediately;
  - whether conflict is shown in toolbar, inspector, toast, or shared shell.
- If lock state is unavailable from runtime, add a task to expose real mutation rejection/lock state from the collaboration layer; do not infer it from remote changes.
- Keep warning filters in one helper with comments for each ignored warning.
- Add an API-level persisted content check after save/reload if existing helpers support it.

#### Risk Assessment

**HIGH.** This is the riskiest plan because SPEC-03 depends on real multi-user timing and possibly missing lock UX. It is correctly strict, but it needs sharper acceptance criteria to avoid ambiguous failure modes.

### Plan 03-03 Review

#### Strengths

- Strong closeout discipline: no requirement can be marked complete without evidence.
- Correctly separates validation strategy from verification results.
- Keeps manual dev-profile QA mandatory but allows blockers to be recorded.
- Preserves the no-op validation hook rationale.
- Updates `SUMMARY.md` based on evidence rather than intent.

#### Concerns

- **HIGH:** `autonomous: true` conflicts with a manual QA task. That is acceptable only if the executor can actually use a browser and dev servers; otherwise the plan must explicitly leave closeout incomplete.
- **MEDIUM:** "Run or record" automated commands is slightly loose. For closeout, commands should be run in the current execution unless impossible.
- **MEDIUM:** It does not require storing or linking Playwright artifacts, screenshots, traces, or downloaded sample metadata. The evidence may become hard to audit later.
- **MEDIUM:** It does not mention updating `.planning/REQUIREMENTS.md` traceability statuses after completion. That may be intentionally deferred, but it should be explicit.
- **LOW:** It lacks `git diff --check`, which is useful before final docs closeout.

#### Suggestions

- Change wording from "run or record" to "run; if not runnable, record blocker and keep related requirement incomplete."
- Add evidence fields for:
  - Playwright report path;
  - trace/video/screenshot path if generated;
  - downloaded PNG/PDF filename, size, and structural check result;
  - document ID/name used in tests.
- Add `git diff --check` to final verification.
- Add an explicit rule: do not set `nyquist_compliant: true`, `SUMMARY.md Complete`, or SPEC statuses complete unless manual dev-profile QA is also passed.
- Decide whether `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are updated in this phase or left for `$gsd-verify-work`/milestone audit.

#### Risk Assessment

**MEDIUM.** The closeout documentation plan is sound, but it depends entirely on honest failed/blocker handling. The manual QA/autonomous mismatch is the main operational risk.

### Overall Risk Assessment

**Overall risk: MEDIUM-HIGH.**

The plan set is well structured and mostly aligned with Phase 3 goals, but it currently has two critical evidence gaps: SPEC-02 master propagation is not directly tested, and SPEC-03 lock/conflict UX may not exist yet. Phase 3 can be closed safely only if those gaps are resolved during execution and the documentation plan refuses completion when evidence is missing. The strongest improvement is to make master create/update/delete and multi-screen instance propagation first-class E2E assertions, not implied side effects of generic canvas editing.

---

## Consensus Summary

Only the Codex reviewer was selected for this cycle (`--codex`), so consensus is synthesized across that reviewer's plan-by-plan findings rather than across multiple AI systems.

### Agreed Strengths

- The plan set correctly treats Phase 3 as closeout and evidence work, not as a broad new feature phase.
- The no-op `DomainValidationHook` policy is preserved and intentionally documented.
- The plans consistently prevent Phase 3 from being marked complete without concrete SPEC-01 through SPEC-04 evidence.
- Export validation is appropriately concrete compared with UI-only smoke testing.
- Three-account collaboration verification is the right bar for SPEC-03.

### Agreed Concerns

- **HIGH:** SPEC-01 evidence is incomplete unless the E2E flow creates or defines a master component and places instances across multiple screens.
- **HIGH:** SPEC-02 evidence is incomplete unless master edits are verified to propagate to all existing instances; editing an instance override is not enough.
- **HIGH:** SPEC-03 evidence remains at risk because lock/conflict UX may not be exposed by the runtime and must be classified as an implementation gap if unavailable.
- **HIGH:** The collaboration closeout does not yet explicitly cover all D-05 operations: master create/update/delete plus instance placement/move/resize.
- **HIGH:** The `autonomous: true` metadata conflicts with required manual QA unless the executor can actually perform browser QA and otherwise leaves the phase incomplete.

### Divergent Views

- None. A single reviewer was invoked in this cycle.
