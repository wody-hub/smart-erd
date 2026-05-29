---
phase: 02-테마-선택
verified: 2026-04-03T10:00:00Z
status: passed
score: 10/10 must-haves verified
---

# Phase 02: 테마 선택 Verification Report

**Phase Goal:** 사용자가 Paper/Graphite/Midnight 3가지 테마 중 하나를 선택하면 앱 전역(ERD 캔버스, 마크다운 에디터, Dialog, Monaco)에 일관되게 적용되고 새로고침 후에도 유지된다
**Verified:** 2026-04-03T10:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `ThemeName = 'paper' \| 'graphite' \| 'midnight'` 계약이 한 곳에 정의되어 있다 | VERIFIED | `client/src/lib/theme.ts:11` -- `export type ThemeName = 'paper' \| 'graphite' \| 'midnight'` |
| 2 | localStorage 값이 없거나 잘못되면 기본 theme는 `paper`다 | VERIFIED | `resolveStoredTheme()` 구현 확인 + unit test 18/18 pass (null/undefined/unknown -> paper) |
| 3 | `document.documentElement`에 `theme-paper/graphite/midnight` 중 하나가 적용된다 | VERIFIED | `applyThemeClass()` 구현 + `main.tsx:26-27` pre-render bootstrap + `useThemeStore.setTheme()` DOM 적용 |
| 4 | Graphite/Midnight에서 `.dark` class도 함께 토글되어 Tailwind `dark:` variant 호환성 유지 | VERIFIED | `applyThemeClass()` -- `isDarkTheme()` true 시 `.dark` 추가, false 시 제거. Unit test 케이스 16-18 통과 |
| 5 | `useDarkMode()`는 store 기반 `isDark`를 반환 (Graphite/Midnight=true, Paper=false) | VERIFIED | `useDarkMode.ts` -- `useThemeStore((state) => state.isDark)` 반환. MutationObserver 제거 완료 |
| 6 | `index.css`에 `.theme-paper`, `.theme-graphite`, `.theme-midnight` 3개 selector 존재 | VERIFIED | `index.css:21` `:root, .theme-paper`, `index.css:111` `.theme-graphite`, `index.css:200` `.theme-midnight` |
| 7 | legacy `.dark` token block 제거, `.dark` class는 compatibility bit로만 남음 | VERIFIED | `grep '^\s*\.dark\s*\{'` -- 결과 없음. `.dark`는 `applyThemeClass()`에서 토글만 담당 |
| 8 | 헤더에서 Palette 아이콘 버튼으로 theme dropdown을 열 수 있다 | VERIFIED | `ThemeSwitcher.tsx` -- Palette icon + DropdownMenu + 3 RadioItem. `Header.tsx:54`에서 LanguageSwitcher 앞에 배치 |
| 9 | 선택 액션이 `useThemeStore().setTheme()`을 호출하여 localStorage persistence와 DOM class 적용을 동시에 트리거 | VERIFIED | `ThemeSwitcher.tsx:52` -- `onValueChange={(value) => setTheme(value as ThemeName)}` |
| 10 | ERD 전용 token(`--erd-*`)과 body gradient도 theme class에 따라 전환 | VERIFIED | Graphite/Midnight 모두 `--erd-table-header`, `--erd-pk`, `--erd-fk` 등 전체 ERD token 보유. `.theme-graphite body`, `.theme-midnight body` gradient 정의 확인 |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/lib/theme.ts` | Theme type, helpers, DOM class | VERIFIED | 87 lines. ThemeName, DEFAULT_THEME, resolveStoredTheme, isDarkTheme, resolveMonacoTheme, applyThemeClass 전부 export |
| `client/src/stores/useThemeStore.ts` | Theme Zustand store | VERIFIED | 54 lines. theme, isDark, setTheme. localStorage read/write + applyThemeClass DOM 적용 |
| `client/src/hooks/useDarkMode.ts` | Store-based dark mode adapter | VERIFIED | 13 lines. useThemeStore 기반 compatibility adapter. MutationObserver 완전 제거 |
| `client/src/components/layout/ThemeSwitcher.tsx` | Header theme dropdown UI | VERIFIED | 72 lines. Palette icon, DropdownMenuRadioGroup, 3 RadioItem, swatch, setTheme 호출 |
| `client/src/index.css` | 3-theme CSS variable rollout | VERIFIED | `:root,.theme-paper` + `.theme-graphite` + `.theme-midnight` selector. ERD/validation/composition/cursor/shadow 전체 token 포함 |
| `DESIGN.md` | 3-theme direction documented | VERIFIED | Paper/Graphite/Midnight 설명, Monaco mapping, `.dark` compatibility bit 정책 문서화 |
| `client/test/unit/theme-config.test.ts` | Theme helper regression tests | VERIFIED | 18 test cases, 전부 pass |
| `client/src/i18n/locales/ko/translation.json` | Korean theme labels | VERIFIED | theme.paper/graphite/midnight/current/aria.switchTheme 키 존재, exact copy 일치 |
| `client/src/i18n/locales/en/translation.json` | English theme labels | VERIFIED | theme.paper/graphite/midnight/current/aria.switchTheme 키 존재, exact copy 일치 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useThemeStore.ts` | `main.tsx` | bootstrap theme initialization | WIRED | `main.tsx:16` import + `main.tsx:26-27` `resolveStoredTheme` + `applyThemeClass` pre-render |
| `useDarkMode.ts` | 4 Monaco consumers | Monaco theme boolean adapter | WIRED | DslCodeEditorPanel, DdlCodeEditorPanel, DdlImportDialog, DdlExportDialog 모두 import + 사용 확인 |
| `ThemeSwitcher.tsx` | `Header.tsx` | header-utility-group placement | WIRED | `Header.tsx:8` import + `Header.tsx:54` 렌더링, LanguageSwitcher 앞 배치 |
| `index.css` | `tailwind.config.js` | semantic token mapping | WIRED | CSS variable 이름(`--background`, `--primary`, `--erd-table-header` 등)이 Tailwind config의 기존 semantic 매핑과 일치 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ThemeSwitcher.tsx` | `theme` | `useThemeStore((s) => s.theme)` | Yes -- localStorage -> resolveStoredTheme -> Zustand state | FLOWING |
| `useDarkMode.ts` | `isDark` | `useThemeStore((s) => s.isDark)` | Yes -- derived from theme via isDarkTheme() | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Theme unit tests pass | `node --test .tmp-test/test/unit/theme-config.test.js` | 18/18 pass | PASS |
| Frontend build succeeds | `npm run build` | Built in 16.31s, no errors | PASS |
| Theme module exports correct functions | `grep "export" client/src/lib/theme.ts` | ThemeName, DEFAULT_THEME, resolveStoredTheme, isDarkTheme, resolveMonacoTheme, applyThemeClass | PASS |
| No standalone `.dark` token block | `grep '^\s*\.dark\s*\{' client/src/index.css` | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| THEME-01 | 02-03-PLAN | 사용자가 헤더에서 Paper/Graphite/Midnight 테마를 선택할 수 있다 | SATISFIED | ThemeSwitcher.tsx -- Palette icon + 3 RadioItem dropdown, Header.tsx에 배치, i18n 키 존재 |
| THEME-02 | 02-01-PLAN, 02-02-PLAN | 선택한 테마가 앱 전역(ERD, 마크다운, Dialog, Monaco)에 일관되게 적용된다 | SATISFIED | index.css 3-theme token rollout (ERD/validation/composition/cursor/shadow 전부 포함). Monaco는 useDarkMode -> isDarkTheme 경유. 전역 CSS variable 기반이므로 Dialog/마크다운도 자동 적용 |
| THEME-03 | 02-01-PLAN, 02-03-PLAN | 새로고침 후에도 선택한 테마가 유지된다 | SATISFIED | useThemeStore.setTheme이 localStorage에 저장. main.tsx bootstrap이 createRoot 전에 localStorage에서 읽어 applyThemeClass 실행. resolveStoredTheme으로 정규화 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (없음) | - | - | - | 모든 phase 파일에서 TODO/FIXME/placeholder/stub 패턴 미발견 |

### Human Verification Required

### 1. Visual Theme Consistency

**Test:** 브라우저에서 Paper -> Graphite -> Midnight 순서로 전환하며 ERD 캔버스, 마크다운 에디터, Dialog, Monaco 에디터의 시각적 일관성 확인
**Expected:** 각 테마에서 header, body gradient, ERD surface, dialog, Monaco 에디터가 해당 테마 톤에 맞게 렌더링된다. Graphite의 cool gray와 Midnight의 navy가 명확히 구분된다
**Why human:** CSS variable 값의 시각적 결과는 프로그래밍적으로 검증 불가

### 2. Refresh Persistence

**Test:** Graphite 테마 선택 후 브라우저 새로고침 수행
**Expected:** 새로고침 후에도 Graphite 테마가 유지되며, flash(깜빡임) 없이 즉시 적용된다
**Why human:** Flash 여부는 렌더링 타이밍에 따라 달라지며 프로그래밍적 검증 불가

### 3. Shadow Depth on Dark Themes

**Test:** Graphite/Midnight에서 card, dialog 등 elevated surface의 shadow가 Paper 대비 적절한 깊이감을 보이는지 확인
**Expected:** Dark background 위에서 shadow가 지나치게 납작하지 않고, Paper 대비 자연스러운 depth를 유지한다
**Why human:** Shadow depth perception은 주관적 시각 평가 필요

### Gaps Summary

모든 자동화 검증 항목을 통과했다. Phase 02의 핵심 계약인 3-theme foundation(type/store/helper), CSS variable rollout(3 selector + ERD/validation/composition/cursor/shadow token), Header UI(ThemeSwitcher + i18n), localStorage persistence + pre-render bootstrap이 모두 구현되어 있고 올바르게 연결되어 있다.

Legacy `.dark` token block은 제거되었고, `.dark` class는 Tailwind `dark:` variant compatibility bit로만 사용된다. Monaco consumer 4개 파일은 기존 `useDarkMode()` hook을 통해 새 store 기반 정책을 자동으로 따른다.

Gap은 없으며, 시각적 일관성과 새로고침 flash 여부만 사람의 확인이 필요하다.

---

_Verified: 2026-04-03T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
