---
phase: 02-테마-선택
plan: 03
subsystem: ui
tags: [theme, dropdown, header, i18n, shadcn]

requires:
  - phase: 02-01
    provides: "ThemeName 타입 계약, useThemeStore, resolveStoredTheme, applyThemeClass"
provides:
  - "ThemeSwitcher 드롭다운 컴포넌트 (Header UI 진입점)"
  - "theme.paper/graphite/midnight/current/aria.switchTheme i18n key (ko/en)"
affects: []

tech-stack:
  added: []
  patterns:
    - "DropdownMenuRadioGroup + swatch 패턴으로 curated theme 선택 UI 구성"

key-files:
  created:
    - client/src/components/layout/ThemeSwitcher.tsx
  modified:
    - client/src/components/layout/Header.tsx
    - client/src/i18n/locales/ko/translation.json
    - client/src/i18n/locales/en/translation.json

key-decisions:
  - "ThemeSwitcher를 LanguageSwitcher 왼쪽에 배치하여 utility group 내 일관된 순서 유지"
  - "swatch 색상은 inline style로 적용 (3개 고정 hex 값이므로 CSS variable 불필요)"

patterns-established:
  - "curated theme swatch: 12px 원형 border + background-color inline style"

requirements-completed: [THEME-01, THEME-03]

duration: 2min
completed: 2026-04-03
---

# Phase 02 Plan 03: Theme Switcher UI Summary

**Header Palette 아이콘 드롭다운으로 Paper/Graphite/Midnight 3개 curated theme 즉시 선택 UI 완성**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T06:11:40Z
- **Completed:** 2026-04-03T06:14:00Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- ThemeSwitcher 컴포넌트: Palette 아이콘 + DropdownMenuRadioGroup으로 3개 theme 선택 UI 구현
- Header utility group에서 LanguageSwitcher 왼쪽에 ThemeSwitcher 배치
- ko/en 번역 리소스에 theme.paper/graphite/midnight/current/aria.switchTheme 키 추가
- setTheme() 호출로 localStorage persistence + DOM class 적용 동시 트리거

## Task Commits

1. **Task 1: Header theme switcher + i18n wiring** - `1c5c5bb` (feat)

## Files Created/Modified

- `client/src/components/layout/ThemeSwitcher.tsx` - Palette 아이콘 드롭다운, 3개 curated theme 선택 + swatch
- `client/src/components/layout/Header.tsx` - ThemeSwitcher import 및 utility group 배치
- `client/src/i18n/locales/ko/translation.json` - theme 관련 한국어 번역 키 추가
- `client/src/i18n/locales/en/translation.json` - theme 관련 영어 번역 키 추가
- `client/src/lib/theme.ts` - ThemeName 타입 및 theme helper 함수 (02-01 병렬 전제조건)
- `client/src/stores/useThemeStore.ts` - theme state Zustand 스토어 (02-01 병렬 전제조건)
- `client/src/constants/storage.ts` - THEME storage key 추가

## Decisions Made

- ThemeSwitcher를 LanguageSwitcher 왼쪽에 배치하여 utility group 내 일관된 순서 유지
- swatch 색상(#F6F1E8, #272C33, #0A1020)은 inline style로 적용 — 3개 고정 hex 값이므로 CSS variable 불필요

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 병렬 worktree에서 02-01 산출물 부재**
- **Found during:** Task 1 (ThemeSwitcher 구현)
- **Issue:** 02-01 plan이 별도 worktree에서 실행되어 theme.ts, useThemeStore.ts, THEME storage key가 이 worktree에 없음
- **Fix:** 02-01 SUMMARY와 PLAN 스펙을 참조하여 동일한 theme.ts, useThemeStore.ts를 생성하고 THEME storage key 추가
- **Files modified:** client/src/lib/theme.ts, client/src/stores/useThemeStore.ts, client/src/constants/storage.ts
- **Verification:** npm run build 성공
- **Committed in:** 1c5c5bb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 병렬 worktree 환경에서 의존 파일 부재로 인한 필수 전제조건 생성. merge 시 02-01 worktree의 파일과 통합됨.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Theme selection UI 완성: 사용자가 헤더에서 3개 curated theme을 즉시 선택 가능
- 02-02 CSS token rollout과 합쳐지면 선택 시 실제 시각적 변화가 적용됨

---
*Phase: 02-테마-선택*
*Completed: 2026-04-03*
