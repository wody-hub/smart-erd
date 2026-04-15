# 계획 리뷰 결과: 테마 선택 기능

## 리뷰 대상

- [implementation-plan.md](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-04-01-테마-선택-기능/implementation-plan.md)
- 현재 코드 기준 진입점
  - [App.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/App.tsx)
  - [main.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/main.tsx)
  - [useDarkMode.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/hooks/useDarkMode.ts)
  - [Header.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/layout/Header.tsx)
  - [LanguageSwitcher.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/layout/LanguageSwitcher.tsx)
  - [storage.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/constants/storage.ts)
  - [index.css](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/index.css)

## README.md 표준 준수 체크

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | 상수 관리 | PASS | `STORAGE_KEYS.THEME` 추가 계획은 README 규칙과 맞습니다. |
| 2 | 공용 유틸 배치 | PASS | `ThemeSwitcher`를 헤더 공용 utility rail에 두는 방향은 현재 구조와 맞습니다. |
| 3 | 토큰 시스템 | PASS | 실제 색상 authority를 `[data-theme]`로 고정하고 `.dark`는 compatibility flag로만 쓰도록 잠겼습니다. |
| 4 | 런타임 초기화 | PASS | `main.tsx` pre-render bootstrap이 계획에 포함돼 first paint flash 대응이 명시됐습니다. |
| 5 | 파일 배치 | PASS | `components/providers` 축을 만들지 않고 `lib/hooks/components/ui/layout`로 배치를 정리했습니다. |
| 6 | API 설계 | PASS | MVP에서 백엔드 제외 결정은 타당합니다. |

## Findings

- 발견 사항 없음

## 종합 판정

- PASS: 구현 시작해도 되는 수준으로 계획이 잠겼습니다.

## 왜 PASS인가

- 테마의 canonical source가 `document.documentElement.dataset.theme`로 고정됐고, `.dark`는 Monaco와 기존 dark-aware code를 위한 파생 family flag로만 정의됐습니다. [implementation-plan.md](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-04-01-테마-선택-기능/implementation-plan.md#L75)
- `main.tsx`에서 React mount 전에 `bootstrapThemeBeforeRender()`를 호출하는 흐름이 추가되어 first paint flash와 Monaco 초기 theme mismatch 리스크가 계획 단계에서 제거됐습니다. [implementation-plan.md](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-04-01-테마-선택-기능/implementation-plan.md#L121)
- `ThemeProvider` 배치도 현재 SI 구조 정의와 맞게 `components/ui/theme-provider.tsx`로 조정됐고, 순수 로직과 훅, 헤더 UI의 책임이 분리됐습니다. [implementation-plan.md](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-04-01-테마-선택-기능/implementation-plan.md#L162)

## 다음 액션

1. `ThemeKey + STORAGE_KEYS.THEME + lib/theme.ts` 구현
2. `main.tsx` pre-render bootstrap 추가
3. `ThemeSwitcher + theme-provider + index.css override` 구현
