# Phase 03 — Pattern Map

**Mapped:** 2026-05-28
**Scope:** screen-spec closeout E2E, collaboration UX, export verification, validation artifacts

---

## Primary Analogs

| Target Work | Closest Existing Pattern | Reuse |
|-------------|--------------------------|-------|
| Screen-spec authenticated fixture | `client/e2e/shared/diagram-e2e.ts` | `getE2EProvisioningConfig()`, `provisionCollaborationFixture({ pluginId: 'screen-spec' })`, `loginViaUi()`, `diagramUrl()` |
| Two-context realtime smoke | `client/e2e/smoke/diagram-collaboration.spec.ts` | isolated contexts, editor navigation, propagation timeout, cleanup |
| Three-account collaboration | `client/e2e/smoke/markdown-three-account-collaboration.spec.ts` | owner/member signup, team invite, access checks, three contexts, browser diagnostics, persisted content check |
| Export download checks | `client/e2e/smoke/dictionary-export-all.spec.ts` | Playwright download/response waiting pattern and file sanity style |
| Screen-spec document model tests | `client/test/unit/screen-design-document.test.ts` | expected screen/master/instance snapshot semantics |
| Screen-spec export helper tests | `client/test/unit/screen-design-export.test.ts` | filename/page layout expectations |
| Backend scope resolver tests | `src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java` | scope/lock behavior baseline |

---

## Files To Touch

### E2E Helpers

- `client/e2e/shared/screen-spec-e2e.ts`
  - New helper layer for screen-spec-only locators/actions.
  - Should wrap role/name locators first and use `data-testid` only where Konva or drag/drop requires it.

### E2E Specs

- `client/e2e/smoke/screen-spec-authoring-export.spec.ts`
  - Single-user authoring, persistence, PNG/PDF download checks.
- `client/e2e/smoke/screen-spec-three-account-collaboration.spec.ts`
  - Three-account realtime propagation, scope lock/conflict UX, save/re-entry.

### Minimal UI/E2E Hook Candidates

- `client/src/pages/screendesign/ScreenDesignEditorShell.tsx`
  - Add stable hooks or compact collaboration status only if required by E2E/UX evidence.
- `client/src/pages/screendesign/ScreenDesignLibrary.tsx`
  - Add wrapper-level test IDs for screen cards/library items if role/text locators are insufficient.
- `client/src/pages/screendesign/ScreenDesignCanvas.tsx`
  - Add a canvas wrapper test ID and export-ready/assertion hook if needed.
- `client/src/pages/screendesign/ScreenDesignInspector.tsx`
  - Add stable hooks for selected-instance fields if role/name locators are insufficient.
- `client/src/pages/screendesign/ScreenDesignInteractivePage.tsx`
  - Preserve live region; optionally expose remote/lock status state if shared shell does not.

### Documentation

- `.planning/phases/03-화면기획-플러그인/03-VALIDATION.md`
- `.planning/phases/03-화면기획-플러그인/03-VERIFICATION.md`
- `.planning/phases/03-화면기획-플러그인/SUMMARY.md`

---

## Conventions To Preserve

- Use Korean UI copy as primary, English translation parity when adding keys.
- Use shadcn/Radix controls and `lucide-react` icons only.
- Use semantic Tailwind tokens and `--screen-spec-*` CSS variables; do not hardcode colors in React.
- Keep backend `ScreenSpecCollaborationPlugin.validationHook()` no-op for v1 closeout.
- Do not add DB migrations or new backend APIs for Phase 03 closeout.
- Use test-profile automation for E2E and dev-profile manual QA for supplemental evidence.

---

## Known Landmines

- Konva internals are not naturally accessible by role/name. Prefer wrapper test hooks around production UI instead of brittle canvas child selectors.
- Drag-and-drop from a draggable button into the Konva stage may be browser-sensitive. The first E2E should exercise the real drag path; helper utilities may centralize coordinates.
- Missing visible lock/conflict state is a SPEC-03 failure under the user's UX-strict decision, even when final data converges.
- PNG/PDF export must be checked through browser downloads; unit tests for filenames/layout are not enough for SPEC-04.
- `gsd-sdk state.record-session` may recalculate global progress incorrectly; inspect `STATE.md` diffs before committing state updates.

