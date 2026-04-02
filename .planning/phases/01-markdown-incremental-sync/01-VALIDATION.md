---
phase: 1
slug: markdown-incremental-sync
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (FE unit), Playwright (E2E), JUnit 5 + Testcontainers (BE) |
| **Config file** | `client/vite.config.ts`, `build.gradle` |
| **Quick run command** | `cd client && npm run test:unit` |
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
| 01-T1 | 01-01 | 1 | DOC-01, DOC-02 | unit | `cd client && npm run test:unit 2>&1 \| grep markdown-section-index` | ✅ created in task | ⬜ pending |
| 01-T2 | 01-01 | 1 | DOC-01, DOC-02 | unit (scaffold) | `test -f client/test/unit/markdown-section-update.test.ts && echo OK` | ✅ created in task | ⬜ pending |
| 02-T1 | 01-02 | 1 | DOC-01 | unit (BE) | `./gradlew test --tests "com.smarterd.domain.diagram.collaboration.MarkdownScopeResolverTest"` | ✅ created in task | ⬜ pending |
| 03-T1 | 01-03 | 2 | DOC-01 | unit | `cd client && npm run test:unit 2>&1 \| grep markdown-section-update` | ✅ scaffold from 01-T2 | ⬜ pending |
| 03-T2 | 01-03 | 2 | DOC-01 | build | `cd client && npm run build 2>&1 \| grep -c "error"` → 0 | ✅ existing files modified | ⬜ pending |
| 03-T3 | 01-03 | 2 | DOC-01 | build | `cd client && npm run build 2>&1 \| grep -c "error"` → 0 | ✅ RemotePendingBanner.tsx | ⬜ pending |
| 04-T1 | 01-04 | 3 | DOC-02 | unit | `cd client && npm run test:unit 2>&1 \| grep markdown-section-preview` | ✅ scaffold from 01-T2 | ⬜ pending |
| 04-T2 | 01-04 | 3 | DOC-02 | build | `cd client && npm run build 2>&1 \| grep -c "error"` → 0 | ✅ existing files modified | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `diff-match-patch` + `@types/diff-match-patch` 패키지 설치 (Plan 01 Task 1에서 수행)
- [x] `client/test/unit/markdown-section-update.test.ts` — section sync 테스트 스캐폴드 (Plan 01 Task 2에서 생성)
- [x] `client/test/unit/markdown-section-preview.test.ts` — 증분 프리뷰 테스트 스캐폴드 (Plan 01 Task 2에서 생성)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 사용자 동시 section 편집 | DOC-01 | 실제 다중 브라우저 세션 필요 | 두 브라우저에서 같은 문서 열고 다른 section 동시 편집 확인 |
| 네트워크 전송량 감소 | DOC-01 | DevTools Network 탭 육안 확인 필요 | 편집 전후 WebSocket payload 크기 비교 |
| 다른 section 원격 변경 시 배너 미표시 (D-07) | DOC-01 | 두 브라우저 세션 필요 | 브라우저 A에서 section1 편집, B에서 section2 편집 → A에 배너 없이 자동 수락 확인 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
