# Phase 03 Summary - 화면기획 플러그인

**Updated:** 2026-04-23
**Status:** 구현 선행 완료, 검증/마감 필요
**Roadmap requirements:** SPEC-01, SPEC-02, SPEC-03, SPEC-04

## Current Verdict

Phase 3 is no longer just a design backlog. Most of the screen-spec implementation already exists in code:

- Frontend document plugin, Yjs adapter, mutation applier, scope resolver, projector/read context
- Screen design editor page with canvas, library, inspector, editor shell, hotkeys, viewport, session/runtime wiring
- Master component and instance CRUD with layer movement, cross-screen placement, master snapshot/cascade behavior
- Client-side PNG/PDF export pipeline
- Backend `screen-spec` collaboration plugin registration and scope resolver
- Unit tests for screen-spec bootstrap, mutation policy, mutation applier, document structure, export helpers, transform helpers, and backend scope resolver

The phase should still remain **in progress** until browser/E2E verification and closeout docs are completed.

## Delivered

### Backend

- `src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecCollaborationPlugin.java`
  - Registers canonical plugin ID `screen-spec`
  - Uses schema version `4`
  - Supports `yjs`
  - Exposes `ScreenSpecScopeResolver`
- `src/main/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolver.java`
  - Resolves scopes for `screen:*`, `master:*`, `instance:*`, and `layer:move`
  - Splits screen, layer, instance, master, and collection scopes
- `src/main/java/com/smarterd/domain/diagram/collaboration/DiagramCollaborationDocumentDefaults.java`
  - Resolves `screen-spec` defaults and `screendesign` alias through the document default path
- `src/main/java/com/smarterd/api/diagram/dto/CreateDiagramRequest.java`
  - Allows `screen-spec` and `screendesign` plugin IDs
- Backend tests:
  - `src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java`
  - `src/test/java/com/smarterd/domain/diagram/service/DiagramServiceTest.java`

### Frontend Plugin Runtime

- `client/src/collaboration/plugins/screen-spec/screen-spec-document-plugin.ts`
  - Provides canvas input adapter commands for screen/master/instance/layer operations
- `client/src/collaboration/plugins/screen-spec/screen-spec-document-mutation-applier.ts`
  - Applies screen, master, instance, and layer mutations to the shared Y.Doc
- `client/src/collaboration/plugins/screen-spec/screen-spec-scope-resolver.ts`
  - Produces fine-grained affected scopes for frontend mutation policy
- `client/src/collaboration/plugins/screen-spec/screen-spec-mutation-policy.ts`
  - Wraps screen-spec commands into shared document mutations
- `client/src/collaboration/plugins/screen-spec/screen-spec-projector.ts`
  - Requests projection refreshes from affected scopes
- `client/src/collaboration/plugins/screen-spec/query/screen-spec-document-read-context-factory.ts`
  - Exposes screen/master/instance/layer read context
- `client/src/collaboration/yjs/screen-spec-yjs-document-adapter.ts`
  - Applies persisted screen-spec content fallback into Y.Doc
- `client/src/collaboration/channel/document/use-screen-design-runtime-bootstrap.ts`
  - Bootstraps screen-spec runtime with static plugin registry and Yjs adapter
- `client/src/collaboration/channel/document/use-screen-design-document-runtime.ts`
  - Wires document store, revision tracker, mutation applier, read context, and affected-scope collection

### Frontend User Surface

- `client/src/pages/document/DocumentEditorRoute.tsx`
  - Routes `screen-spec` documents to `ScreenDesignPage`
- `client/src/components/workspace/CreateDocumentDialog.tsx`
  - Lets users create screen-spec documents
- `client/src/components/workspace/DocumentHubTabContent.tsx`
  - Displays screen-spec document type badges in the hub
- `client/src/pages/screendesign/**`
  - Main editor shell, canvas, library, inspector, document model, viewport, hotkeys, session, export, labels, and rendering
- `client/src/types/document.ts`
  - Defines `screen-spec` and `screendesign` alias handling
- `client/src/types/workspace.ts`
  - Includes `screen-spec` as a workspace document type

### Export

- `client/src/pages/screendesign/use-screen-design-export.ts`
  - Provides selected-screen PNG export and full-document PDF export
- `client/src/pages/screendesign/screen-design-instance-renderer.tsx`
  - Provides hidden export stage rendering
- `client/src/pages/screendesign/screen-design-export.ts`
  - Provides filename, pixel ratio, and PDF page layout helpers

### Tests

- `client/test/unit/screen-spec-bootstrap.test.ts`
- `client/test/unit/screen-spec-mutation-policy.test.ts`
- `client/test/unit/screen-spec-mutation-applier.test.ts`
- `client/test/unit/screen-design-document.test.ts`
- `client/test/unit/screen-design-export.test.ts`
- `client/test/unit/screen-design-transform-utils.test.ts`
- `src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java`
- Screen-spec create/alias/dictionary guard coverage in `src/test/java/com/smarterd/domain/diagram/service/DiagramServiceTest.java`

## Requirement Status

| Requirement | Current Status | Evidence | Remaining Gap |
| --- | --- | --- | --- |
| SPEC-01: 마스터 컴포넌트를 정의하고 여러 화면에 인스턴스로 배치 | Implemented, not closeout-verified | `ScreenDesignLibrary`, `ScreenDesignCanvas`, `ScreenDesignInspector`, `ScreenSpecDocumentMutationApplier` | Browser smoke/E2E for create document -> add master -> place instances across screens |
| SPEC-02: 마스터 수정 시 인스턴스 자동 반영 | Implemented, not closeout-verified | mutation applier cascade/snapshot behavior and unit tests | Browser smoke/E2E for update master -> verify existing instances update while overrides remain |
| SPEC-03: 협업 코어 위 실시간 협업 | Partially verified by unit/runtime wiring | Yjs adapter, screen-design session/runtime hooks, FE/BE scope resolvers | Multi-client E2E with WebSocket, scope lock, remote update propagation |
| SPEC-04: PNG/PDF 내보내기 | Implemented, not closeout-verified | `use-screen-design-export.ts`, hidden export stage, export helper tests | Browser export smoke verifying real file creation/output quality |

## Remaining Phase 3 Work

1. Create formal Phase 3 execution/closeout artifacts under `.planning/phases/03-화면기획-플러그인/`.
2. Add or run browser E2E for the core happy path:
   - create `screen-spec` document
   - open screen design editor
   - add/rename/move screens
   - add/update/delete master components
   - place/update/delete instances
   - verify save/reopen persistence
3. Add or run multi-client collaboration verification:
   - two sessions open the same screen-spec document
   - screen/master/instance changes propagate
   - conflicting edits are controlled by scope locks
4. Add export smoke verification:
   - selected screen PNG
   - full document PDF
   - output dimensions and visible content sanity check
5. Decide whether structural `DomainValidationHook` remains intentionally no-op for v1, or add backend validation for screen/master/instance document shape.
6. Produce final `VALIDATION.md` and `VERIFICATION.md` for SPEC-01~SPEC-04.

## Explicit Non-Goals For Current Closeout

The older design roadmap in `plan/2026-03-25-1445-화면기획-플러그인-설계/06-구현-로드맵.md` includes a larger long-term feature set. The following are not required to close the current `.planning/ROADMAP.md` Phase 3 unless the scope is reopened:

- Variant axes and slot replacement
- Screen flow diagram and annotations
- Image upload / asset runtime integration
- Collaborative cursor/selection presence beyond existing document session behavior
- JSON server-side artifact serializer

## Recommended Next Action

Treat Phase 3 as a closeout/verification phase, not a greenfield implementation phase. The fastest route is:

1. Write `03-01-PLAN.md` for closeout-only work.
2. Add Playwright/browser coverage for SPEC-01~SPEC-04.
3. Run targeted backend/frontend tests plus production build.
4. Produce `VALIDATION.md` and `VERIFICATION.md`.
5. Mark Phase 3 complete only after E2E/QA evidence exists.
