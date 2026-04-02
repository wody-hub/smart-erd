---
phase: 1
slug: markdown-incremental-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --test (FE unit), Playwright (E2E), JUnit 5 + Testcontainers (BE) |
| **Config file** | `client/playwright.config.ts`, `build.gradle` |
| **Quick run command** | `cd client && node --test src/collaboration/plugins/markdown/**/*.test.ts` |
| **Full suite command** | `cd client && npx playwright test --grep markdown` |
| **Estimated runtime** | ~30 seconds (unit), ~120 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run quick unit tests
- **After every plan wave:** Run full Playwright suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DOC-01 | unit+E2E | `node --test` + `playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DOC-02 | unit | `node --test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `diff-match-patch` + `@types/diff-match-patch` 패키지 설치
- [ ] `client/src/collaboration/plugins/markdown/__tests__/` — section sync 테스트 스텁
- [ ] `client/src/collaboration/plugins/markdown/__tests__/section-preview.test.ts` — 증분 프리뷰 테스트 스텁

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 사용자 동시 section 편집 | DOC-01 | 실제 다중 브라우저 세션 필요 | 두 브라우저에서 같은 문서 열고 다른 section 동시 편집 확인 |
| 네트워크 전송량 감소 | DOC-01 | DevTools Network 탭 육안 확인 필요 | 편집 전후 WebSocket payload 크기 비교 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
