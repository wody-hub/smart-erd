---
phase: 02-테마-선택
plan: 01
subsystem: ui
tags: [theme, zustand, tailwind, dark-mode, monaco]

requires: []
provides:
  - "ThemeName 타입 계약 (paper | graphite | midnight)"
  - "theme helper 함수 (resolveStoredTheme, isDarkTheme, resolveMonacoTheme, applyThemeClass)"
  - "useThemeStore Zustand 스토어 (theme state + localStorage + DOM class 동기화)"
  - "useDarkMode() store 기반 호환성 어댑터"
  - "main.tsx pre-render theme bootstrap"
affects: [02-02-PLAN, 02-03-PLAN]

tech-stack:
  added: []
  patterns:
    - "theme-{name} CSS class + .dark compatibility bit 패턴"
    - "resolveStoredTheme 정규화 단일 진입점 패턴"

key-files:
  created:
    - client/src/lib/theme.ts
    - client/src/stores/useThemeStore.ts
    - client/test/unit/theme-config.test.ts
  modified:
    - client/src/constants/storage.ts
    - client/src/hooks/useDarkMode.ts
    - client/src/main.tsx

key-decisions:
  - "applyThemeClass에서 .dark는 Tailwind dark: variant 호환성 bit로만 취급, token source selector 아님"
  - "useDarkMode를 MutationObserver 제거 후 useThemeStore 셀렉터 어댑터로 교체 — Monaco consumer 4개 파일 수정 불필요"

patterns-established:
  - "Theme 판정 기준 단일화: resolveStoredTheme()을 bootstrap과 store hydration에서 공유"
  - "DOM class 패턴: theme-paper/theme-graphite/theme-midnight + .dark compatibility toggle"

requirements-completed: [THEME-02, THEME-03]

duration: 3min
completed: 2026-04-03
---

# Phase 02 Plan 01: Theme Foundation Summary

**ThemeName 계약(paper/graphite/midnight) + Zustand theme store + pre-render bootstrap + useDarkMode store 어댑터 + 18개 unit test**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T06:04:53Z
- **Completed:** 2026-04-03T06:08:06Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- ThemeName 타입과 pure helper 함수를 lib/theme.ts에 단일 모듈로 정의
- useThemeStore로 theme state + localStorage + DOM class를 동기화하는 Zustand 스토어 구현
- main.tsx에서 createRoot 전 theme bootstrap으로 페이지 로드 시 flash 방지
- useDarkMode를 MutationObserver 기반에서 useThemeStore 셀렉터 어댑터로 교체 (기존 Monaco consumer 4개 파일 수정 불필요)
- 18개 unit test로 resolveStoredTheme, isDarkTheme, resolveMonacoTheme, applyThemeClass 검증

## Task Commits

1. **Task 1: theme helper + store + bootstrap + hook compatibility** - `817f73c` (feat)

## Files Created/Modified

- `client/src/lib/theme.ts` - ThemeName 타입, resolveStoredTheme, isDarkTheme, resolveMonacoTheme, applyThemeClass 헬퍼
- `client/src/stores/useThemeStore.ts` - theme/isDark state + setTheme action Zustand 스토어
- `client/test/unit/theme-config.test.ts` - 18개 theme helper regression test
- `client/src/constants/storage.ts` - THEME storage key 추가
- `client/src/hooks/useDarkMode.ts` - MutationObserver 제거, useThemeStore 셀렉터 어댑터로 교체
- `client/src/main.tsx` - pre-render theme bootstrap 추가

## Decisions Made

- applyThemeClass에서 .dark class는 Tailwind `dark:` variant 호환성 bit로만 사용하고, token source selector로는 theme-* class를 사용하기로 결정
- useDarkMode를 MutationObserver 제거 후 store 셀렉터 어댑터로 교체하여 기존 Monaco consumer 코드 수정 없이 새 theme 정책 적용

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- worktree 환경에서 node_modules가 없어 test:unit 스크립트 실행 시 tsc를 찾지 못함 — node_modules 심링크로 해결 후 테스트 통과 확인

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Theme foundation 계약이 고정되어 02-02 (CSS token rollout)와 02-03 (Header UI) 플랜에서 사용 가능
- useThemeStore.setTheme()과 ThemeName 타입이 theme switcher UI 구현의 진입점

---
*Phase: 02-테마-선택*
*Completed: 2026-04-03*
