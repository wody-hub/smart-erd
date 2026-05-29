---
phase: 1
slug: markdown-incremental-sync
status: verified
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
| 01-T1 | 01-01 | 1 | DOC-01, DOC-02 | unit | `cd client && npm run test:unit 2>&1 \| grep markdown-section-index` | ✅ created in task | ✅ green |
| 01-T2 | 01-01 | 1 | DOC-01, DOC-02 | unit (scaffold) | `test -f client/test/unit/markdown-section-update.test.ts && echo OK` | ✅ created in task | ✅ green |
| 02-T1 | 01-02 | 1 | DOC-01 | unit (BE) | `./gradlew test --tests "com.smarterd.domain.diagram.collaboration.MarkdownScopeResolverTest"` | ✅ created in task | ✅ green |
| 03-T1 | 01-03 | 2 | DOC-01 | unit | `cd client && npm run test:unit 2>&1 \| grep markdown-section-update` | ✅ scaffold from 01-T2 | ✅ green |
| 03-T2 | 01-03 | 2 | DOC-01 | build | `cd client && npm run build 2>&1 \| grep -c "error"` → 0 | ✅ existing files modified | ✅ green |
| 03-T3 | 01-03 | 2 | DOC-01 | build | `cd client && npm run build 2>&1 \| grep -c "error"` → 0 | ✅ RemotePendingBanner.tsx | ✅ green |
| 04-T1 | 01-04 | 3 | DOC-02 | unit | `cd client && npm run test:unit 2>&1 \| grep markdown-section-preview` | ✅ scaffold from 01-T2 | ✅ green |
| 04-T2 | 01-04 | 3 | DOC-02 | build | `cd client && npm run build 2>&1 \| grep -c "error"` → 0 | ✅ existing files modified | ✅ green |

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

---

## Nyquist Audit Trail

### 1차 감사 (2026-04-03)

**감사자:** Claude (gsd-nyquist-auditor)

| Task ID | 요구사항 | 테스트 유형 | 결과 | 비고 |
|---------|----------|------------|------|------|
| 01-T1 | DOC-01, DOC-02 | unit | ✅ green | 18개 section-index 테스트 통과 (245/0 pass/fail) |
| 01-T2 | DOC-01, DOC-02 | scaffold | ✅ green | 파일 존재 확인 |
| 02-T1 | DOC-01 | unit (BE) | ✅ green | MarkdownScopeResolverTest BUILD SUCCESSFUL |
| 03-T1 | DOC-01 | unit | ✅ green | section-update 테스트 9개 통과 |
| 03-T2 | DOC-01 | build | ❌ red | TS2339 빌드 에러 (ESCALATED) |
| 03-T3 | DOC-01 | build | ❌ red | 동일 TS2339 빌드 에러 (ESCALATED) |
| 04-T1 | DOC-02 | unit | ✅ green | section-preview 테스트 7개 통과 |
| 04-T2 | DOC-02 | build | ❌ red | 동일 TS2339 빌드 에러 (ESCALATED) |

ESCALATED: `useMarkdownSectionPreview.ts:84` TS2339 빌드 에러 — `'html' in data` 타입 가드 누락.

### 2차 감사 (재검증, 2026-04-03)

**감사자:** Claude (gsd-nyquist-auditor)
**사유:** 1차 감사에서 ESCALATED된 빌드 에러가 `'html' in data` 타입 가드 추가로 수정됨. 전체 8개 검증 커맨드 재실행.

| Task ID | 요구사항 | 테스트 유형 | 결과 | 비고 |
|---------|----------|------------|------|------|
| 01-T1 | DOC-01, DOC-02 | unit | ✅ green | section-index 테스트 통과 (245/0 pass/fail 전체) |
| 01-T2 | DOC-01, DOC-02 | scaffold | ✅ green | `markdown-section-update.test.ts` 존재 확인 |
| 02-T1 | DOC-01 | unit (BE) | ✅ green | MarkdownScopeResolverTest BUILD SUCCESSFUL (4 tasks up-to-date) |
| 03-T1 | DOC-01 | unit | ✅ green | section-update 관련 테스트 (buildSectionCommands 4개 subtest) 통과 |
| 03-T2 | DOC-01 | build | ✅ green | `tsc -b && vite build` 성공 (4251 modules, 18.83s). `grep -c "error"` 1회 매칭은 에셋 파일명 `api-error-*.js` 오탐 |
| 03-T3 | DOC-01 | build | ✅ green | 동일 빌드 — 실제 TS/빌드 에러 0건 |
| 04-T1 | DOC-02 | unit | ✅ green | SectionPreviewCache 7개 subtest 통과 |
| 04-T2 | DOC-02 | build | ✅ green | 동일 빌드 — 실제 TS/빌드 에러 0건 |

**참고:** `grep -c "error"` 검증 커맨드가 빌드 에셋 파일명 `api-error-CwNjhfiI.js`를 오탐함. 실제 빌드는 에러 없이 성공 (`tsc -b` 통과, `vite build` 완료). 향후 `grep -c "^error\|TS[0-9]"` 등으로 패턴 정밀화 권장.
