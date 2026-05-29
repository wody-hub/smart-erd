# Phase 3: 화면기획 플러그인 - Research

**Researched:** 2026-05-28
**Domain:** screen-spec closeout verification over existing Yjs collaboration and export runtime
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 3 closeout requires both automated test-profile evidence and dev-profile manual browser QA.
- **D-02:** `03-VALIDATION.md` and `03-VERIFICATION.md` are required closeout outputs.
- **D-03:** SPEC-01 through SPEC-04 each need at least one concrete evidence item.
- **D-04:** Collaboration closeout must use three browser contexts/accounts.
- **D-05:** The collaboration scenario must cover screen create/rename, master create/update/delete, instance placement/move/resize, save/re-entry, and scope lock behavior.
- **D-06:** Collaboration pass/fail is UX-strict: propagation delay, missing lock indicator, or remote-state display issues are failures.
- **D-07:** PNG and PDF export are both mandatory for SPEC-04.
- **D-08:** Export verification should use Playwright download handling, filename checks, non-empty file size checks, PNG sanity, and PDF structural validation.
- **D-09:** Manual dev QA can supplement export evidence, but automated download checks are primary.
- **D-10:** `ScreenSpecCollaborationPlugin.validationHook()` intentionally remains no-op for v1 closeout.
- **D-11:** No code TODO, backlog entry, or backend structure-validation implementation is required in this phase.
- **D-12:** The validation rationale is documented through `03-VALIDATION.md`.
- **D-13:** Artifact flow is `03-CONTEXT.md` -> `$gsd-plan-phase 3` -> closeout execution -> `03-VALIDATION.md`/`03-VERIFICATION.md`.
- **D-14:** `SUMMARY.md` should be updated after closeout and link to validation/verification evidence.

### Claude's Discretion

- Exact Playwright spec file names and helper extraction strategy.
- Whether to add one comprehensive E2E file or multiple focused specs.
- Stable test data setup, provided both automated test-profile evidence and dev-profile QA are documented.

### Deferred Ideas (OUT OF SCOPE)

- Variant axes and slot replacement.
- Screen flow diagram and annotations.
- Image upload or advanced asset runtime integration.
- Collaborative cursor/selection presence beyond the existing document session behavior.
- Server-side JSON artifact serializer.
- Backend deep structural validation for screen/master/instance document shape.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-01 | 화면기획 플러그인에서 마스터 컴포넌트를 정의하고 여러 화면에 인스턴스로 배치할 수 있다 | `ScreenDesignLibrary`, `ScreenDesignCanvas`, `ScreenDesignInspector`, `useScreenDesignDocument()`, and screen-spec mutation applier already implement the document operations. Closeout needs browser E2E from document creation to multi-screen placement and persistence. |
| SPEC-02 | 마스터 컴포넌트를 수정하면 모든 인스턴스에 자동 반영된다 | `screen-design-document.ts` and `screen-spec-document-mutation-applier.ts` keep master snapshots and inherited instance fields. Closeout needs a browser assertion that a master update propagates to existing instances while explicit overrides remain controlled. |
| SPEC-03 | 화면기획 플러그인이 기존 협업 코어(Yjs, ScopeLock, Presence) 위에서 실시간 협업된다 | Frontend plugin/runtime and backend `ScreenSpecCollaborationPlugin`/`ScreenSpecScopeResolver` are wired. Closeout needs a three-account Playwright spec with propagation, lock/conflict UX, save, and reload checks. |
| SPEC-04 | 화면기획 결과를 산출물(PNG/PDF)로 내보낼 수 있다 | `use-screen-design-export.ts`, `screen-design-export.ts`, and `ScreenDesignExportStage` implement PNG/PDF export. Closeout needs real browser download checks for both formats. |

</phase_requirements>

---

## Summary

Phase 3 should be planned as a strict closeout phase. The screen-spec plugin is already implemented across frontend runtime, backend plugin registration, document model, mutation policy/applier, Yjs adapter, UI shell, and export pipeline. The remaining work is to create high-signal evidence that the implemented behavior satisfies SPEC-01 through SPEC-04 and to document the intentional v1 validation policy.

The fastest safe route is three execution slices:

1. Add screen-spec E2E helpers and automated browser coverage for the single-user authoring flow and export downloads.
2. Add three-account collaboration coverage for propagation, lock/conflict UX, save, and re-entry.
3. Run targeted backend/frontend tests plus dev-profile manual QA, then write `03-VALIDATION.md`, `03-VERIFICATION.md`, and final `SUMMARY.md`.

The current roadmap marks Phase 3 with a UI hint and the planning workflow has the UI safety gate enabled. There is no `03-UI-SPEC.md` in `.planning/phases/03-화면기획-플러그인/` at research time, so manual `$gsd-plan-phase 3` will stop at the UI-SPEC gate unless `$gsd-ui-phase 3` is run first or the user explicitly reruns planning with `--skip-ui`.

---

## Existing Implementation Map

### Frontend Runtime

- `client/src/pages/screendesign/ScreenDesignInteractivePage.tsx` composes the editor shell, canvas, library, inspector, export stage, and collaboration runtime.
- `client/src/pages/screendesign/use-screen-design-session.ts` bootstraps document detail/bootstrap and screen-spec runtime.
- `client/src/collaboration/channel/document/use-screen-design-runtime-bootstrap.ts` and `use-screen-design-document-runtime.ts` wire the static plugin registry, Yjs shared document engine, mutation session, read context, revision tracker, and projector.
- `client/src/collaboration/yjs/screen-spec-yjs-document-adapter.ts` applies persisted screen-spec content fallback into the live Y.Doc.

### Document Model and Mutations

- `client/src/pages/screendesign/screen-design-document.ts` owns schema version 4, screen/master/instance types, fallback library, Y.Map creation, persisted content parsing, snapshot reading, instance clamp logic, and master snapshot resolution.
- `client/src/pages/screendesign/use-screen-design-document.ts` exposes editor operations: add/rename/move/delete screen, add/update/delete master, add/update/delete instance, move layer.
- `client/src/collaboration/plugins/screen-spec/screen-spec-document-plugin.ts` defines the screen-spec document plugin and canvas input adapter commands.
- `client/src/collaboration/plugins/screen-spec/screen-spec-document-mutation-applier.ts` applies screen, master, instance, and layer mutations to the shared Y.Doc.
- `client/src/collaboration/plugins/screen-spec/screen-spec-mutation-policy.ts` and `screen-spec-scope-resolver.ts` map commands to collaboration mutations and affected scopes.

### User Surface

- `client/src/components/workspace/CreateDocumentDialog.tsx` creates screen-spec documents.
- `client/src/components/workspace/DocumentHubTabContent.tsx` lists screen-spec documents and badges.
- `client/src/pages/document/DocumentEditorRoute.tsx` routes `screen-spec` documents to `ScreenDesignPage`.
- `ScreenDesignLibrary` supports screen add/select/move/delete and master drag start.
- `ScreenDesignCanvas` accepts library drops, renders instances in Konva, supports drag/transform updates, and exposes visible empty/connecting states.
- `ScreenDesignInspector` edits selected screen name, instance label/color/size overrides, layer order, delete, and orphan rebind.
- `ScreenDesignEditorShell` provides screen selection, frame preset selection, zoom/fit controls, export menu, and collaboration readiness status.

### Backend Collaboration

- `src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecCollaborationPlugin.java` registers plugin ID `screen-spec`, schema version 4, Yjs support, scope resolver, and the intentional no-op validation hook.
- `src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolver.java` resolves screen, master, instance, and layer scopes.
- `src/main/java/com/smarterd/domain/diagram/collaboration/DiagramCollaborationDocumentDefaults.java` handles screen-spec defaults and the `screendesign` alias.
- `src/main/java/com/smarterd/api/diagram/dto/CreateDiagramRequest.java` accepts `screen-spec` and `screendesign` plugin IDs.

### Export

- `client/src/pages/screendesign/use-screen-design-export.ts` implements selected-screen PNG export and all-screens PDF export.
- `client/src/pages/screendesign/screen-design-export.ts` centralizes filename sanitization, PNG/PDF filename builders, pixel ratio selection, and PDF page layout.
- `client/src/pages/screendesign/screen-design-instance-renderer.tsx` renders hidden export stages for each screen.
- `client/test/unit/screen-design-export.test.ts` currently covers filename and page layout helpers, but not real browser downloads.

---

## Existing Test Patterns

### Reusable E2E Setup

- `client/e2e/shared/diagram-e2e.ts` already supports `pluginId?: 'erd' | 'markdown' | 'screen-spec'` in `provisionCollaborationFixture()`.
- `diagramUrl()` builds the editor route used by ERD, markdown, and screen-spec documents.
- `getE2EProvisioningConfig()` can provision accounts without mandatory env credentials and chooses the first available local profile among 4501/9501, 4502/9502, 4503/9503.
- `loginViaUi()` provides a stable login path and stores the access token in localStorage.

### Collaboration Patterns

- `client/e2e/smoke/diagram-collaboration.spec.ts` demonstrates two isolated browser contexts, shared fixture, navigation, propagation assertion, and cleanup.
- `client/e2e/smoke/markdown-three-account-collaboration.spec.ts` demonstrates three separate accounts, owner-created team/project/document, member invites, member document access checks, isolated browser contexts, browser console/page-error diagnostics, propagation waits, save, persisted content API check, and cleanup.
- The screen-spec collaboration spec should adapt the three-account pattern rather than the two-account ERD smoke pattern.

### Unit Coverage Already Present

- `client/test/unit/screen-spec-bootstrap.test.ts`
- `client/test/unit/screen-spec-mutation-policy.test.ts`
- `client/test/unit/screen-spec-mutation-applier.test.ts`
- `client/test/unit/screen-design-document.test.ts`
- `client/test/unit/screen-design-export.test.ts`
- `client/test/unit/screen-design-transform-utils.test.ts`
- `src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java`
- `src/test/java/com/smarterd/domain/diagram/service/DiagramServiceTest.java`

These tests support the validation rationale, but they are not enough to close SPEC-01 through SPEC-04 without browser evidence.

---

## Planning Implications

### Plan 1: Screen-Spec E2E Harness and Single-User Authoring

The executor should add a focused helper module, likely under `client/e2e/shared/`, for screen-spec-specific actions:

- Create/open screen-spec document using existing provisioning helpers.
- Wait for the screen design editor to be ready by asserting `workspace.action.backToDocuments`, `screenSpec.canvas.workspaceTitle`, screen list, library, canvas, inspector, and `screenSpec.status.ready`.
- Add and rename screens through the library/inspector flow.
- Drag a known library item onto the Konva canvas.
- Select and move/resize an instance through mouse interaction.
- Save, reload/re-enter, and assert the authoring state remains visible.

If direct drag-and-drop from `ScreenDesignLibrary` into Konva is flaky, the plan should allow adding test-only helper selectors or a stable E2E utility path, but production behavior must still be exercised in at least one smoke path. Any added selectors should be semantic and unobtrusive, such as `data-testid` values on screen-spec editor primitives.

### Plan 2: Three-Account Collaboration and Lock/Conflict Verification

The executor should create a three-account screen-spec collaboration spec by adapting `markdown-three-account-collaboration.spec.ts`:

- Owner provisions a `screen-spec` document.
- Two additional users are signed up and invited to the team.
- All three users open the same document in separate browser contexts.
- Owner performs screen create/rename and master/instance operations.
- Member one observes propagation and performs a different scoped change.
- Member two observes both changes and attempts or participates in a same-scope conflict/lock scenario.
- Assertions must include visible remote state and lock/conflict UX where the shared collaboration shell exposes it.
- Save, API/persistence check, reload/re-entry, and browser diagnostics must be recorded.

Risk: screen-spec currently exposes `collaborationReady` but not obviously a dedicated per-scope lock indicator inside `ScreenDesignEditorShell`, `ScreenDesignCanvas`, or `ScreenDesignInspector`. If the shared document shell provides lock UI elsewhere, the E2E should assert it. If no user-visible lock indicator exists, the collaboration plan must treat that as a Phase 3 closeout failure and implement the minimal visible indicator required by D-06 before verification can pass.

### Plan 3: Export Automation and Closeout Artifacts

The executor should add automated export checks using Playwright downloads:

- Open a populated screen-spec document.
- Trigger the export dropdown in `ScreenDesignEditorShell`.
- Download PNG and assert filename suffix `.png`, non-empty file size, PNG signature, and preferably dimensions or pixel nonblank sanity.
- Download PDF and assert filename suffix `.pdf`, non-empty file size, `%PDF` signature, and page-count or equivalent structural sanity.
- Record commands and resulting evidence in `03-VERIFICATION.md`.
- Map SPEC-01 through SPEC-04 to unit/E2E/manual evidence in `03-VALIDATION.md`.
- Update `SUMMARY.md` with final status and links to evidence artifacts.

Node-side file inspection can use built-in `fs` buffers for signatures. If page-count parsing requires a library, prefer an existing dependency or a small structural check over adding a new dependency just for closeout.

---

## Validation Architecture

`03-VALIDATION.md` should be created during closeout execution and must contain a requirement-by-requirement evidence matrix:

| Requirement | Required Evidence |
|-------------|-------------------|
| SPEC-01 | Browser/E2E evidence for screen-spec document creation/open, master definition, multi-screen instance placement, save/re-entry. |
| SPEC-02 | Browser/E2E or targeted unit evidence that master edits propagate to existing instances, with override behavior explicitly covered. |
| SPEC-03 | Three-account browser/E2E evidence for propagation, scope lock/conflict UX, remote state visibility, save, and reload. |
| SPEC-04 | Playwright download evidence for PNG and PDF filenames, non-empty files, and structural sanity. |

The same validation file should explicitly document why backend `validationHook()` remains no-op for v1:

- Frontend document shape is normalized by `ensureScreenDesignDocumentStructure()` and read through `readScreenDesignDocument()`.
- Mutations are constrained through the screen-spec mutation policy/applier and scope resolvers.
- Backend scope safety is covered by `ScreenSpecScopeResolverTest`.
- Browser E2E verifies the actual user-facing document lifecycle.
- Deep backend shape validation is intentionally deferred and should not be represented as a Phase 3 TODO.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing screen-spec UI-SPEC blocks `$gsd-plan-phase 3` | Planning workflow exits before PLAN generation | Run `$gsd-ui-phase 3` first, or explicitly rerun with `--skip-ui` if the user accepts planning without a UI contract. |
| Konva canvas lacks semantic locators | E2E may become coordinate-heavy and flaky | Add minimal stable `data-testid` hooks to editor primitives if needed; keep production UX unchanged. |
| Lock indicator is not visible in screen-spec UI | D-06 fails even if Yjs convergence works | Verify shared collaboration UI first; if absent, implement a minimal visible lock/remote-state indicator before closeout. |
| Export stage not ready when download is triggered | PNG/PDF tests become flaky | Wait for selected screen, hidden export stage readiness, and export button enabled state before triggering downloads. |
| PDF page-count parsing adds dependency churn | Closeout expands unnecessarily | Prefer signature plus structural sanity unless an existing dependency already exposes page counting. |
| Dev-profile and test-profile data diverge | Manual QA evidence may not match automated results | Record exact profile, ports, accounts, commands, and document IDs in `03-VERIFICATION.md`. |

---

## Recommended Verification Commands

Targeted commands for execution planning:

```bash
./gradlew test --tests '*ScreenSpecScopeResolverTest' --tests '*DiagramServiceTest'
cd client && npm run test:unit -- screen-spec screen-design
cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0
cd client && npm run test:e2e -- e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0
cd client && npm run build
```

The exact E2E spec names may change during planning, but the closeout must preserve the same evidence categories.

---

## Primary Recommendation

Create a small number of closeout plans rather than reopening Phase 3 as broad feature work:

1. `03-01-PLAN.md` — E2E harness + single-user authoring/export smoke.
2. `03-02-PLAN.md` — three-account collaboration, lock/conflict UX, save/re-entry.
3. `03-03-PLAN.md` — validation/verification artifacts, targeted test run, final summary.

If the UI-SPEC gate remains enabled, generate `03-UI-SPEC.md` before writing these plans.

