---
phase: 3
slug: 화면기획-플러그인
status: evidence-collected-build-blocked
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-28
updated: 2026-05-29T10:15:36+09:00
---

# Phase 3 — Validation Matrix

Phase 3 now has concrete evidence for SPEC-01 through SPEC-04. The phase is not marked complete because the required frontend production build still fails on unrelated WBS TypeScript errors.

## Validation Inputs

| Source | Purpose |
| --- | --- |
| `03-01-SUMMARY.md` | Single-user authoring, persistence, and PNG/PDF export smoke evidence |
| `03-02-SUMMARY.md` | Three-account collaboration, lock/rejected-edit UX, and scope resolver evidence |
| `03-VERIFICATION.md` | Exact closeout command/manual QA log |
| `client/e2e/smoke/screen-spec-authoring-export.spec.ts` | SPEC-01, SPEC-02, SPEC-04 browser evidence |
| `client/e2e/smoke/screen-spec-three-account-collaboration.spec.ts` | SPEC-02, SPEC-03 browser collaboration evidence |
| `src/test/java/com/smarterd/domain/diagram/collaboration/ScreenSpecScopeResolverTest.java` | Backend scope resolver lock/cascade baseline |

## Requirement Evidence Matrix

| Requirement | Status | Evidence | Residual Risk |
| --- | --- | --- | --- |
| SPEC-01: 마스터 컴포넌트를 정의하고 여러 화면에 인스턴스로 배치 | Evidence PASS | `screen-spec-authoring-export` creates a `screen-spec` document, renames screens, creates a custom master, places instances on two screens, saves, reloads, and rechecks persisted content. Manual dev QA also created `Manual CTA 1780017133-nzws03` and placed it on `Manual Landing 1780017133-nzws03`. | Phase closeout still blocked by unrelated frontend build failure. |
| SPEC-02: 마스터 수정 시 인스턴스 자동 반영 | Evidence PASS | `screen-spec-authoring-export` updates the master label/color and verifies existing instances inherit `Primary CTA ...` and `#2563eb`; `screen-spec-three-account-collaboration` verifies remote users observe inherited master changes. Unit tests cover mutation applier cascade and override behavior. | None specific to SPEC-02 beyond build gate. |
| SPEC-03: 협업 코어 위 실시간 협업 | Evidence PASS | `screen-spec-three-account-collaboration` opens owner/member-one/member-two isolated contexts, asserts authorized access, verifies screen/master/instance propagation, checks visible lock status, verifies rejected same-scope rename, deletes the master, and confirms orphan state after reload. Backend and frontend scope resolver coverage backs the lock model. | Browser MCP manual session saw one transient WebSocket console error; strict E2E diagnostics are the canonical console gate and passed. |
| SPEC-04: PNG/PDF 내보내기 | Evidence PASS | `screen-spec-authoring-export` validates real PNG and PDF downloads. Manual dev QA retained PNG `151277` bytes with signature `89504e470d0a1a0a` and PDF `54764` bytes with `%PDF`, `/Type /Page`, `/Count 1`, and `startxref`. | None specific to SPEC-04 beyond build gate. |

## Task Verification Map

| Task ID | Plan | Requirement | Threat Ref | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| 03-01-01 | 03-01 | SPEC-01, SPEC-04 | T-03-01 / T-03-02 | `screen-spec-authoring-export` fixture creates isolated `screen-spec` docs and validates exports | green |
| 03-01-02 | 03-01 | SPEC-01 | T-03-01 | Save/re-entry persistence in `screen-spec-authoring-export` and manual dev QA | green |
| 03-01-03 | 03-01 | SPEC-04 | T-03-02 | Automated and manual PNG/PDF byte/signature checks | green |
| 03-02-01 | 03-02 | SPEC-03 | T-03-03 / T-03-04 | Owner/member-one/member-two E2E access and propagation evidence | green |
| 03-02-02 | 03-02 | SPEC-02, SPEC-03 | T-03-04 | Same-scope lock/rejected-edit UX in E2E, scope resolver tests | green |
| 03-03-01 | 03-03 | SPEC-01, SPEC-02, SPEC-03, SPEC-04 | T-03-07 / T-03-08 / T-03-09 | `03-VERIFICATION.md` records all commands and manual QA; build remains failed | red |

## Command Results

| Command | Result |
| --- | --- |
| `./gradlew test --tests '*ScreenSpecScopeResolverTest' --tests '*DiagramServiceTest'` | PASS |
| `cd client && npm run test:unit -- screen-spec screen-design` | PASS, 363 tests |
| `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0` | PASS |
| `cd client && npm run test:e2e -- e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0` | PASS |
| `cd client && npm run build` | FAIL, unrelated WBS TypeScript errors |
| `git diff --check` | PASS |

## DomainValidationHook Policy

`ScreenSpecCollaborationPlugin.validationHook()` intentionally remains no-op for v1 closeout.

Validation safety for this phase is provided by:

- Frontend document normalization through `ensureScreenDesignDocumentStructure()`.
- Snapshot reads through `readScreenDesignDocument()`.
- Screen-spec mutation policy/applier unit coverage.
- Frontend and backend scope resolver coverage.
- Three-account browser E2E for the actual Yjs/ScopeLock/Presence path.
- PNG/PDF browser download smoke checks for generated artifacts.

No TODO, backlog item, or backend deep structure-validation implementation is added in this phase.

## Traceability Status

`.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` statuses were not updated by this 03-03 closeout task. Traceability status updates remain deferred to `$gsd-verify-work` or milestone audit because the production build gate is still red.

## Validation Sign-Off

- [x] SPEC-01 through SPEC-04 each have concrete evidence.
- [x] Three-account collaboration evidence exists.
- [x] PNG and PDF export evidence both exist.
- [x] Dev-profile manual browser QA is recorded in `03-VERIFICATION.md`.
- [x] No watch-mode flags were used.
- [ ] `npm run build` passes.
- [ ] `nyquist_compliant: true` set in frontmatter after all gates pass.

**Approval:** blocked by unrelated WBS build failure.
