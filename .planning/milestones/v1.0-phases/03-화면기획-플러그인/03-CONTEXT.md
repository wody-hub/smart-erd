# Phase 03: 화면기획-플러그인 - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 closes out the already-implemented `screen-spec` screen planning plugin. The work is not a greenfield feature build. It must prove, document, and finalize SPEC-01 through SPEC-04 with browser/E2E/QA evidence:

- Users can define master components and place instances across screens.
- Master changes propagate to existing instances.
- The plugin collaborates in real time on top of the existing Yjs/ScopeLock/Presence core.
- Screen planning output can be exported as PNG and PDF.

New screen-spec capabilities such as variant axes, slot replacement, image upload, flow diagrams, and advanced server-side artifact serialization remain out of scope for this closeout.

</domain>

<decisions>
## Implementation Decisions

### Closeout Verification Scope

- **D-01:** Phase 3 closeout requires both automated test-profile evidence and dev-profile manual browser QA. Automated verification should run against the `test` profile, while manual QA can use the currently running dev profile.
- **D-02:** `03-VALIDATION.md` and `03-VERIFICATION.md` are required closeout outputs. `03-VALIDATION.md` maps SPEC-01 through SPEC-04 to coverage. `03-VERIFICATION.md` records commands, browser QA, and evidence.
- **D-03:** Each of SPEC-01, SPEC-02, SPEC-03, and SPEC-04 must have at least one concrete evidence item before Phase 3 can be marked complete.

### Collaboration Verification

- **D-04:** Collaboration closeout must use three browser contexts/accounts, not only a two-account happy path.
- **D-05:** The collaboration scenario must cover the full screen-spec editing flow: screen creation and rename, master creation/update/delete, instance placement/move/resize, save/re-entry, and scope lock behavior.
- **D-06:** Collaboration pass/fail is UX-strict. Propagation delays, missing lock indicators, or remote state display problems are failures, even if final persisted data eventually converges.

### Export Verification

- **D-07:** PNG and PDF export are both mandatory for SPEC-04. If either format fails, SPEC-04 remains incomplete.
- **D-08:** Export verification should be automated with Playwright download handling. Evidence should include filename checks, non-empty file size checks, PNG non-empty sanity, and PDF page count or equivalent structural validation.
- **D-09:** Manual dev QA can supplement export evidence, but automated download checks are the primary acceptance signal.

### DomainValidationHook Policy

- **D-10:** `ScreenSpecCollaborationPlugin.validationHook()` intentionally remains no-op for v1 closeout.
- **D-11:** No code TODO, backlog entry, or backend structure-validation implementation is required in this phase. The safety case is documented through `03-VALIDATION.md`.
- **D-12:** The validation rationale is that v1 screen-spec document integrity is guarded by the frontend document model, mutation policy/applier tests, scope resolver tests, and E2E/browser evidence rather than backend deep shape validation.

### Artifact Closeout

- **D-13:** Artifact flow is `03-CONTEXT.md` -> `$gsd-plan-phase 3` -> closeout execution -> `03-VALIDATION.md`/`03-VERIFICATION.md`.
- **D-14:** The existing `.planning/phases/03-화면기획-플러그인/SUMMARY.md` should be updated after closeout into the final Phase 3 summary and should link to canonical evidence in `03-VALIDATION.md` and `03-VERIFICATION.md`.

### the agent's Discretion

- The planner may decide the exact Playwright spec file names and helper extraction strategy.
- The planner may decide whether to add one comprehensive E2E file or multiple focused specs, as long as SPEC-01 through SPEC-04 evidence remains explicit.
- The planner may choose the most stable test data setup for test-profile automation, provided the dev-profile manual QA path is also documented.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements

- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, implementation status, and closeout gaps.
- `.planning/REQUIREMENTS.md` — SPEC-01 through SPEC-04 requirement status and traceability.
- `.planning/phases/03-화면기획-플러그인/SUMMARY.md` — current implementation inventory and remaining closeout work.

### Screen-Spec Frontend Runtime

- `client/src/pages/screendesign/` — screen design editor surface, canvas, library, inspector, session, export, and document model.
- `client/src/collaboration/plugins/screen-spec/` — screen-spec document plugin, mutation policy, mutation applier, projector, scope resolver, and read context.
- `client/src/collaboration/yjs/screen-spec-yjs-document-adapter.ts` — Y.Doc adapter and persisted content fallback path for screen-spec documents.
- `client/src/pages/document/DocumentEditorRoute.tsx` — pluginId-based routing into the screen design editor.
- `client/src/components/workspace/CreateDocumentDialog.tsx` — screen-spec document creation entry point.
- `client/src/components/workspace/DocumentHubTabContent.tsx` — screen-spec document listing/badge entry point.

### Screen-Spec Backend Collaboration

- `src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecCollaborationPlugin.java` — backend plugin registration and intentional v1 no-op validation hook policy.
- `src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolver.java` — backend screen/master/instance/layer scope resolution.
- `src/main/java/com/smarterd/domain/diagram/collaboration/DiagramCollaborationDocumentDefaults.java` — screen-spec default content and alias handling.
- `src/main/java/com/smarterd/api/diagram/dto/CreateDiagramRequest.java` — accepted plugin IDs, including `screen-spec` and `screendesign`.

### Existing Test Patterns

- `client/e2e/smoke/diagram-collaboration.spec.ts` — browser-context collaboration smoke pattern to adapt for screen-spec.
- `client/e2e/smoke/markdown-three-account-collaboration.spec.ts` — three-account collaboration pattern to adapt for strict screen-spec verification.
- `client/e2e/shared/diagram-e2e.ts` — shared E2E helpers and authenticated setup patterns.
- `client/test/unit/screen-spec-bootstrap.test.ts` — screen-spec runtime bootstrap unit coverage.
- `client/test/unit/screen-spec-mutation-policy.test.ts` — screen-spec mutation policy coverage.
- `client/test/unit/screen-spec-mutation-applier.test.ts` — screen-spec mutation applier coverage.
- `client/test/unit/screen-design-document.test.ts` — screen design document model coverage.
- `client/test/unit/screen-design-export.test.ts` — export helper coverage.
- `src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java` — backend scope resolver coverage.
- `src/test/java/com/smarterd/domain/diagram/service/DiagramServiceTest.java` — screen-spec create/alias/dictionary guard coverage.

### Project Standards

- `README.md` — project architecture, coding standards, E2E profile guidance, and frontend/backend boundaries.
- `.planning/codebase/STACK.md` — stack and tooling constraints.
- `.planning/codebase/ARCHITECTURE.md` — collaboration architecture, plugin boundaries, and data flow.
- `.planning/codebase/CONVENTIONS.md` — Java/TypeScript conventions, i18n, error handling, and test/style rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `client/src/pages/screendesign/use-screen-design-export.ts` provides PNG/PDF export actions and export progress state.
- `client/src/pages/screendesign/screen-design-export.ts` provides export filename, pixel ratio, and PDF page layout helpers.
- `client/src/pages/screendesign/screen-design-instance-renderer.tsx` provides the hidden export stage used for output rendering.
- `client/src/pages/screendesign/screen-design-document.ts` provides the screen/master/instance document model used by unit tests and E2E setup.
- Existing Playwright collaboration specs already demonstrate multi-context authentication, room entry, and propagation checks.

### Established Patterns

- Real-time collaboration is plugin-based: frontend document plugins and backend collaboration plugins should be extended without changing the core collaboration framework.
- Browser E2E should use configured Smart ERD E2E environment variables and the `test` profile when deterministic login behavior is needed.
- Frontend server state remains in API modules + React Query; screen-spec closeout should not introduce ad hoc axios calls.
- UI assertions should respect existing i18n text and semantic roles where practical.
- Export verification should use Playwright download events rather than relying only on visual/manual observation.

### Integration Points

- Screen-spec document creation starts in the workspace document hub and routes through `DocumentEditorRoute`.
- Runtime collaboration uses the document channel session hooks under `client/src/collaboration/channel/document/`.
- Backend ticketing and WebSocket transport remain the shared diagram/document collaboration path.
- `03-VALIDATION.md`, `03-VERIFICATION.md`, and the final `SUMMARY.md` are the closeout artifacts downstream agents must update after execution.

</code_context>

<specifics>
## Specific Ideas

- Treat this as a strict closeout phase: do not broaden Phase 3 into additional screen design product features.
- Collaboration verification should be intentionally stricter than “eventual data convergence”; user-visible lock and remote state behavior matter.
- Keep backend `DomainValidationHook` no-op for v1, but make the tradeoff explicit in validation evidence.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-화면기획-플러그인*
*Context gathered: 2026-05-28*
