---
phase: 03-화면기획-플러그인
plan: 03
status: complete
created: 2026-05-29
updated: 2026-05-29T10:55:28+09:00
nyquist_compliant: true
---

# Phase 03 Verification Evidence

This file records the closeout evidence for SPEC-01 through SPEC-04. Phase 3 is verified: screen-spec behavior passes targeted backend, unit, browser E2E, manual QA, export, whitespace, and frontend production build gates.

## Environment

| Item | Value |
| --- | --- |
| Date/time | 2026-05-29T10:55:28+09:00 |
| Backend dev profile | `http://127.0.0.1:9503` / `http://localhost:9503` |
| Frontend dev profile | `http://localhost:4503` |
| Browser QA tool | Codex in-app Browser / Playwright MCP |
| Playwright report | `client/playwright-report/index.html` |
| Trace/video/screenshot | None retained for passing smoke runs; Playwright `test-results` only contains `.last-run.json` |

## Automated Verification

| Command | Profile / endpoint | Result | Evidence summary |
| --- | --- | --- | --- |
| `./gradlew test --tests '*ScreenSpecScopeResolverTest' --tests '*DiagramServiceTest'` | Local backend/JUnit | PASS | Build successful in 2s; `ScreenSpecScopeResolverTest` and `DiagramServiceTest` executed/covered targeted backend scope and service behavior. |
| `cd client && npm run test:unit -- screen-spec screen-design` | Node unit tests | PASS | 363 tests passed, 0 failed. Covers screen-spec document normalization, mutation policy/applier, transform/export helpers, and screen-design runtime utilities. |
| `cd client && npm run test:e2e -- e2e/smoke/screen-spec-authoring-export.spec.ts --browser=chromium --workers=1 --retries=0` | Playwright Chromium, resolved dev endpoints `4503/9503` | PASS | 1 smoke passed in 10.9s. Proves create/rename screen, master create/update, cross-screen inherited propagation, save/re-entry, PNG/PDF export assertions. Earlier evidence target: `id=662`, `Screen Spec E2E 1780016816610-zgcyfx`. |
| `cd client && npm run test:e2e -- e2e/smoke/screen-spec-three-account-collaboration.spec.ts --browser=chromium --workers=1 --retries=0` | Playwright Chromium, resolved dev endpoints `4503/9503` | PASS | 1 smoke passed in 19.4s. Proves owner/member-one/member-two access, remote propagation, same-scope lock/rejected-edit UX, master delete orphan state, and reload persistence. Earlier evidence target: `id=663`, `Screen Spec Collab 1780016832678-vzxtgg`. |
| `cd client && npm run build` | Frontend TypeScript/Vite build | PASS | Vite built successfully in 17.32s after adding `wbs.validation.nameRequired` translations and removing the stale `milestoneName` prop from `SortableWbsRowCells`. |
| `git diff --check` | Git whitespace check | PASS | No whitespace errors in current diff. |

## Automated Export Evidence

The `screen-spec-authoring-export` smoke validates browser downloads internally with Playwright `Download` objects:

| Format | Automated assertion | Result |
| --- | --- | --- |
| PNG | suggested filename ends in `.png`, byte length > 0, first 8 bytes match `89504e470d0a1a0a` | PASS |
| PDF | suggested filename ends in `.pdf`, byte length > 0, first 4 bytes are `%PDF`, body contains `/Type /Page`, `/Count`, or `startxref` | PASS |

The passing Playwright run does not retain the downloaded files outside the test worker.

## Dev-profile Manual QA

Manual QA was performed against the dev-profile servers with a browser-visible `screen-spec` document.

| Item | Value |
| --- | --- |
| URL | `http://localhost:4503/teams/683/projects/681/diagrams/664` |
| Account | `manual-screen-spec-1780017133-nzws03@example.com` |
| Team | `683` / `Manual Screen Team 1780017133-nzws03` |
| Project | `681` / `Manual Screen Project 1780017133-nzws03` |
| Document | `664` / `Manual Screen Spec QA 1780017133-nzws03` |
| Screen | `Manual Landing 1780017133-nzws03` |
| Master | `Manual CTA 1780017133-nzws03` |

| Step | Result | Notes |
| --- | --- | --- |
| Open screen-spec document | PASS | Editor shell loaded and status pill showed `캔버스 연결됨`. |
| Add/rename screen | PASS | Selected screen renamed to `Manual Landing 1780017133-nzws03`. |
| Create/place master instance | PASS | Created `Manual CTA 1780017133-nzws03` and placed an instance on the canvas. |
| Move/resize instance | PASS | Inspector numeric controls set position to `x=384`, `y=256`, width `240`, height `88`. |
| Save/re-enter persistence | PASS | Save POST to `/ydoc-snapshot` succeeded; after reload, screen and master remained visible. |
| Export PNG | PASS | `Manual Screen Spec QA 1780017133-nzws03-Manual Landing 1780017133-nzws03.png`, 151277 bytes, PNG signature `89504e470d0a1a0a`. |
| Export PDF | PASS | `Manual Screen Spec QA 1780017133-nzws03.pdf`, 54764 bytes, `%PDF` signature, structural sanity found `/Type /Page`, `/Count 1`, and `startxref`. |
| Three-account / three-context collaboration | PASS via browser automation | Dev-profile Playwright smoke opened owner/member-one/member-two contexts for `Screen Spec Collab 1780016832678-vzxtgg` and passed. Manual single-browser QA did not duplicate the three-context flow because the smoke is the canonical three-context evidence. |

Download files retained by Browser MCP:

- `/var/folders/0c/w6zr1lls7nggx4f19l5dxf4h0000gn/T/playwright-mcp-output/1780017139047/Manual-Screen-Spec-QA-1780017133-nzws03-Manual-Landing-1780017133-nzws03.png`
- `/var/folders/0c/w6zr1lls7nggx4f19l5dxf4h0000gn/T/playwright-mcp-output/1780017139047/Manual-Screen-Spec-QA-1780017133-nzws03.pdf`

## Console And Runtime Notes

- The manual browser session initially produced a login/API console error from an unauthenticated UI login attempt before token injection. The target document then loaded and the screen-spec editor showed `캔버스 연결됨`.
- One transient WebSocket console error was observed in the Browser MCP event stream, but the editor status was connected and the save/export/manual operations succeeded. The stricter three-account E2E diagnostics remain the authoritative collaboration console gate.

## Closeout Gate

| Gate | Result |
| --- | --- |
| SPEC-01 authoring evidence | PASS |
| SPEC-02 master propagation evidence | PASS |
| SPEC-03 three-account collaboration and lock/conflict evidence | PASS |
| SPEC-04 PNG/PDF export evidence | PASS |
| Dev-profile manual browser QA | PASS |
| Frontend production build | PASS |

Phase 3 is **검증 완료**. SPEC-01 through SPEC-04 are complete and the closeout gate passes.
