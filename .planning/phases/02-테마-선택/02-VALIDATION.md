---
phase: 2
slug: 테마-선택
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
updated: 2026-05-29T11:35:20+09:00
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test 기반 frontend unit + TypeScript build |
| **Config file** | `client/package.json`, `client/tsconfig.test.json` |
| **Quick run command** | `cd client && npm run test:unit` |
| **Full suite command** | `cd client && npm run build` |
| **Estimated runtime** | ~20 seconds (unit), ~25 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npm run test:unit`
- **After every plan wave:** Run `cd client && npm run build`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-T1 | 02-01 | 1 | THEME-02, THEME-03 | unit + build | `cd client && npm run test:unit` | ✅ created in task | ✅ green |
| 02-T2 | 02-02 | 2 | THEME-02 | build | `cd client && npm run build` | ✅ existing files modified | ✅ green |
| 02-T3 | 02-03 | 2 | THEME-01, THEME-03 | build | `cd client && npm run build` | ✅ existing files modified | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing frontend unit/build infrastructure already exists
- [x] `client/test/unit/theme-config.test.ts` — theme helper/store fallback regression tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header theme dropdown opens and current item is highlighted | THEME-01 | Dropdown open state / highlighted item is UX-level behavior | 헤더의 Palette 버튼 클릭 → Paper/Graphite/Midnight 항목 노출 → 현재 선택 항목에 체크 표시 확인 |
| Teams / Projects / Diagrams / Document / Dictionary surface tones all change consistently | THEME-02 | 시각적 일관성은 실제 화면 비교가 필요 | 각 화면을 순회하며 배경, 카드, border, text tone, header chrome이 theme에 맞게 바뀌는지 확인 |
| Monaco editors switch light/dark correctly | THEME-02 | Monaco 내부 테마는 브라우저에서 확인해야 한다 | DSL / DDL editor를 열고 Paper=`vs`, Graphite/Midnight=`vs-dark` 렌더링 확인 |
| Selected theme survives refresh and app reopen | THEME-03 | reload / Electron reopen은 런타임 상태 확인이 필요 | theme 변경 후 새로고침, Electron이면 앱 재실행까지 수행해서 같은 theme가 유지되는지 확인 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or existing infrastructure
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers required new test artifact
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready

## Closeout Audit Note

2026-05-29 milestone audit normalization confirmed Phase 2 already has PASS verification in `02-VERIFICATION.md` for THEME-01 through THEME-03. This file now reflects that completed state so the validation frontmatter and task rows match the delivered verification evidence.
