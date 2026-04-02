# 테마 선택 기능 구현 계획서

## 1. 목표

사용자가 `언어 선택`과 비슷한 방식으로 앱 테마를 선택할 수 있게 한다.

이번 범위의 목적은 다음 3가지를 충족하는 것이다.

- 현재 `Paper` 기반 디자인 시스템을 유지하면서도 사용자 취향에 맞는 시각 톤을 제공한다.
- CSS 변수 기반 토큰 구조를 재사용해 화면 전체가 일관되게 바뀌게 한다.
- ERD/Markdown/공용 Dialog/Dropdown/Select까지 포함한 UI가 같은 테마를 공유하도록 한다.

이번 범위는 **“자유 색상 커스터마이징”이 아니라 “큐레이션된 테마 선택”** 이다.

## 2. 범위

### 포함

- 헤더 utility rail에 `ThemeSwitcher` 추가
- `localStorage` 기반 사용자 테마 선택 저장
- `document.documentElement.dataset.theme` 기반 테마 적용
- CSS 변수 오버라이드 방식의 3개 테마 제공
- Monaco editor(`vs`, `vs-dark` 또는 커스텀 이름)와 앱 테마 연결
- 공용 UI surface/dialog/dropdown/select/card 색감 연동
- ERD/Markdown 화면 브라우저 회귀 QA

### 제외

- 서버 저장 기반 사용자 테마 동기화
- 팀/프로젝트 단위 공용 테마 정책
- 사용자가 직접 색상 팔레트를 조합하는 기능
- export HTML/MD 결과물에 앱 테마를 주입하는 기능
- 테마별 로고/일러스트/아이콘 세트 교체

## 3. 권장 제품 결정

이번 기능은 아래 방식으로 고정한다.

- 방식: `언어 선택`과 같은 헤더 드롭다운
- 저장: `localStorage`
- 적용 단위: 앱 전역
- 테마 개수: 3개
- 기본값: `paper`

제안 테마:

| key | 이름 | 성격 | 비고 |
| --- | --- | --- | --- |
| `paper` | Paper | 현재 warm editorial 기본 테마 | 기본값 |
| `graphite` | Graphite | 차분한 neutral/productivity 테마 | 저채도 |
| `midnight` | Midnight | 어두운 집중 작업 테마 | Monaco `vs-dark` 사용 |

`paper`는 현재 디자인 시스템의 정본이고, `graphite`와 `midnight`는 선택 가능한 변형으로 둔다.

## 4. 현재 코드 기준 진입점

### 언어 선택 구조

- 헤더 우측 공용 유틸은 [Header.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/layout/Header.tsx) 에서 조립한다.
- 언어 선택 드롭다운은 [LanguageSwitcher.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/layout/LanguageSwitcher.tsx) 가 이미 있다.
- 언어 저장은 [i18n/index.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/i18n/index.ts) 의 `localStorage` detector를 통해 수행된다.

### 테마 토큰 구조

- 전역 토큰은 [index.css](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/index.css) `:root`와 `.dark`에 있다.
- 공용 surface class는 `workspace-shell`, `surface-display`, `surface-operational`, `control-surface`, `dialog-overlay-scrim`, `header-utility-*` 구조로 이미 정리돼 있다.

### 다크 모드 의존 코드

- Monaco editor theme는 [useDarkMode.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/hooks/useDarkMode.ts) 의 `dark class` 감지에 의존한다.
- 실제 사용처는 `DdlImportDialog`, `DdlExportDialog`, `DslCodeEditorPanel`, `DdlCodeEditorPanel` 등이다.

## 5. 핵심 아키텍처 결정

### 5.1 Theme runtime source of truth

테마의 canonical source는 브라우저 런타임의 `document.documentElement.dataset.theme` 으로 고정한다.

- 저장값: `localStorage[STORAGE_KEYS.THEME]`
- 런타임 적용값: `document.documentElement.dataset.theme`
- 실제 색상 토큰 authority:
  - `paper` → `:root` 또는 `[data-theme='paper']`
  - `graphite` → `[data-theme='graphite']`
  - `midnight` → `[data-theme='midnight']`
- 다크 여부 파생값:
  - `paper` / `graphite` → light family
  - `midnight` → dark family

기존 `.dark` class 기반 동작은 유지하되, `.dark`는 **Monaco와 기존 dark-aware consumer를 위한 family flag** 로만 사용한다.  
즉 `midnight`의 실제 색상값을 `.dark`에 별도로 정의하지 않는다. `.dark`는 `data-theme='midnight'`가 적용된 뒤에 같이 토글되는 파생 신호다.

즉:

1. 사용자가 테마를 고름
2. `ThemeProvider`가 storage에 저장
3. `data-theme`를 적용
4. dark family 테마면 `.dark` class를 같이 부여
5. Monaco/코드 에디터는 이 파생 dark state를 사용

### 5.2 Theme switching strategy

테마 변경은 클래스 토글이 아니라 **CSS custom property override** 로 구현한다.

- 기본 `:root` = `paper`
- `[data-theme='graphite']` = graphite override
- `[data-theme='midnight']` = midnight override

이 방식이면 기존 Tailwind semantic color mapping을 바꾸지 않고도 대부분의 컴포넌트가 같이 바뀐다.

### 5.3 MVP persistence policy

이번 1차는 서버 persistence를 두지 않는다.

이유:

- 현재 인증/설정 구조에 사용자 preference API가 없다.
- 언어도 FE localStorage 우선 흐름을 쓰고 있어 일관성이 있다.
- 테마는 UX preference라서 cross-device sync보다 빠른 제공이 우선이다.

후속 phase에서만 서버 저장을 검토한다.

### 5.4 First paint bootstrap

테마는 React mount 이후가 아니라 **React mount 이전** 에 한 번 적용한다.

이유:

- 현재 Monaco와 일부 편집기 chrome은 `.dark` class를 기준으로 초기 테마를 결정한다.
- `ThemeProvider`를 `App.tsx`에만 주입하면 첫 paint에 `paper`가 잠깐 보이는 flash가 생길 수 있다.

따라서:

1. `main.tsx`에서 `createRoot(...)` 전에 `bootstrapThemeBeforeRender()`를 호출
2. 이 helper가 storage에서 theme를 읽어 `data-theme`와 `.dark`를 먼저 적용
3. `ThemeProvider`는 mount 후 상태 보정과 사용자 전환만 담당

## 6. 데이터 모델 / 상태 모델

### 6.1 Theme key

신규 FE 타입:

```ts
export type ThemeKey = 'paper' | 'graphite' | 'midnight';
```

### 6.2 Storage key

[storage.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/constants/storage.ts) 에 추가:

```ts
THEME: 'smart-erd-theme'
```

### 6.3 Theme metadata

신규 메타 정의:

```ts
interface ThemeOption {
  key: ThemeKey;
  labelKey: string;
  descriptionKey: string;
  family: 'light' | 'dark';
}
```

## 7. 프론트엔드 설계

### 7.1 신규 파일

| 파일 | 역할 |
| --- | --- |
| `client/src/types/theme.ts` | `ThemeKey`, `ThemeOption` 타입 |
| `client/src/lib/theme.ts` | 테마 옵션 목록, storage read/write, DOM apply, pre-render bootstrap |
| `client/src/hooks/useTheme.ts` | 현재 테마 조회/설정 훅 |
| `client/src/components/layout/ThemeSwitcher.tsx` | 헤더 드롭다운 UI |
| `client/src/components/ui/theme-provider.tsx` | 앱 런타임 theme context/provider |

### 7.2 수정 파일

| 파일 | 수정 내용 |
| --- | --- |
| `client/src/main.tsx` | `bootstrapThemeBeforeRender()` 호출 |
| `client/src/App.tsx` | `ThemeProvider` 주입 |
| `client/src/components/layout/Header.tsx` | `LanguageSwitcher` 옆에 `ThemeSwitcher` 추가 |
| `client/src/constants/storage.ts` | `STORAGE_KEYS.THEME` 추가 |
| `client/src/index.css` | `[data-theme='graphite']`, `[data-theme='midnight']` 토큰 오버라이드 추가 |
| `client/src/hooks/useDarkMode.ts` | dark class 의존 유지 또는 `useTheme` 기반으로 대체 |
| Monaco 사용 컴포넌트들 | `theme={isDark ? 'vs-dark' : 'vs'}` 유지 또는 공용 util로 치환 |
| `client/src/i18n/locales/*/translation.json` | 테마 라벨/설명 문구 추가 |

### 7.3 Header integration

현재 구조를 유지한다.

- `Header.tsx`
  - `LanguageSwitcher`
  - `ThemeSwitcher`
  - electron settings button
  - auth utility

즉 `ThemeSwitcher`는 `LanguageSwitcher`와 같은 레벨의 공용 utility로 둔다.

### 7.4 UI interaction

`ThemeSwitcher`는 드롭다운 메뉴로 구현한다.

표시 방식:

- 아이콘: palette 또는 swatch 계열
- 항목: 테마 이름 + 짧은 설명
- 현재 테마 항목은 `font-bold` 또는 check 표시

예시:

- Paper: 따뜻한 문서형 기본 테마
- Graphite: 절제된 생산성 테마
- Midnight: 어두운 집중 작업 테마

### 7.5 File placement rationale

`ThemeProvider`는 새 `components/providers/` 축을 만들지 않는다.

이유:

- 현재 SI 구조 정의에는 `components/providers`가 없다.
- 이 provider는 도메인 UI가 아니라 앱 전역 runtime wiring에 가깝다.

따라서 배치는 다음처럼 고정한다.

- 순수 로직: `lib/theme.ts`
- 재사용 훅: `hooks/useTheme.ts`
- 공용 runtime provider: `components/ui/theme-provider.tsx`
- 헤더 UI: `components/layout/ThemeSwitcher.tsx`

## 8. CSS 토큰 설계

### 8.1 유지할 semantic tokens

다음 토큰명은 그대로 유지한다.

- `--background`
- `--foreground`
- `--card`
- `--popover`
- `--primary`
- `--secondary`
- `--border`
- `--input`
- `--header-*`
- `--erd-*`
- `--success`
- `--composition-*`

즉, 컴포넌트는 토큰 이름을 바꾸지 않고 값만 theme override 한다.

### 8.2 Theme override block

예상 구조:

```css
:root,
[data-theme='paper'] { ... }

[data-theme='graphite'] { ... }

[data-theme='midnight'] { ... }
```

규칙:

- 실제 색상 토큰은 `:root`와 `[data-theme='*']` 블록에서만 정의한다.
- `.dark`에는 새 theme token override를 추가하지 않는다.
- `.dark`는 `midnight`일 때 붙는 compatibility class로만 유지한다.

헤더/카드/표면 대비는 `Monaco + ReactFlow + status colors` 기준으로 다시 맞춘다.

### 8.3 Theme-specific constraints

- `paper`
  - 현재 warm paper 그대로
- `graphite`
  - warm tint 축소
  - neutral gray/ink 계열 강화
  - primary만 cobalt 유지
- `midnight`
  - dark base
  - 카드/패널 대비 강화
  - `header-bg`와 editor chrome를 너무 같게 만들지 말고 한 단계 분리

## 9. Monaco / editor 연동

### 9.1 1차 전략

MVP에서는 Monaco theme를 2계층으로만 매핑한다.

| Theme | Monaco |
| --- | --- |
| `paper` | `vs` |
| `graphite` | `vs` |
| `midnight` | `vs-dark` |

이를 위한 공용 util 예시:

```ts
export function resolveMonacoTheme(theme: ThemeKey): 'vs' | 'vs-dark' {
  return theme === 'midnight' ? 'vs-dark' : 'vs';
}
```

### 9.2 useDarkMode 처리

현재 `useDarkMode`는 `.dark` class만 본다.

선택지:

1. 유지
   - `ThemeProvider`가 `midnight`에서만 `.dark` class를 부여
2. 정리
   - `useDarkMode`를 `useTheme().family === 'dark'` 기반으로 리팩터링

1차는 변경 폭이 작은 1안을 권장하되, `.dark`는 반드시 `data-theme`에서 파생되는 신호로만 취급한다.

## 10. API / 백엔드 설계

이번 범위는 백엔드 변경 없음.

### 명시적 결정

- REST API 추가 없음
- DB migration 없음
- 사용자 preference 엔티티/테이블 없음

후속 phase에서만 검토:

- `/api/me/preferences/theme`
- user profile preference column

## 11. i18n 설계

신규 번역 키 예시:

```json
"theme": {
  "label": "테마",
  "paper": "Paper",
  "graphite": "Graphite",
  "midnight": "Midnight",
  "paperDescription": "따뜻한 문서형 기본 테마",
  "graphiteDescription": "절제된 생산성 테마",
  "midnightDescription": "어두운 집중 작업 테마"
}
```

영문 번역도 동일 구조로 추가한다.

## 12. 구현 순서

### Phase 1. runtime foundation

- `ThemeKey`, `ThemeOption`, `STORAGE_KEYS.THEME`
- `lib/theme.ts`
- `bootstrapThemeBeforeRender()`
- `ThemeProvider`
- `main.tsx` pre-render apply
- `App.tsx` 주입

완료 기준:

- React mount 전에 저장된 테마가 DOM에 먼저 적용된다.
- 앱 로드시 저장된 테마가 자동 적용된다.
- `document.documentElement.dataset.theme` 값이 반영된다.
- `midnight`에서 first paint flash가 없다.

### Phase 2. header switching

- `ThemeSwitcher.tsx`
- `Header.tsx`에 utility 추가
- 번역 키 추가

완료 기준:

- 헤더에서 테마를 바꾸면 즉시 전체 앱 표면 톤이 바뀐다.
- 새로고침 후에도 유지된다.

### Phase 3. token override

- `paper / graphite / midnight` 토큰 정의
- header, dialog, card, select, dropdown, workspace hero, editor shell 검증

완료 기준:

- 팀/프로젝트/문서/사전/편집기에서 큰 위화감 없이 같은 테마가 유지된다.

### Phase 4. editor sync

- `useDarkMode`/Monaco 연동
- DDL/DSL/code panel/dark surface 확인

완료 기준:

- `midnight`에서 Monaco가 dark theme로 열린다.
- `paper/graphite`에서는 light theme로 열린다.

### Phase 5. QA

- 브라우저 smoke
- responsive
- dropdown/dialog/select transparency 재검증

완료 기준:

- 주요 플로우에서 콘솔 error/warning 없음
- 팝업 본체 투명도 이슈 없음

## 13. QA 체크리스트

### 공통

- 로그인 후 테마 전환 가능
- 새로고침 후 선택 유지
- 로그아웃/재로그인 후 같은 브라우저에서 유지

### 화면별

- 팀 홈
- 프로젝트 홈
- 문서 허브
- 새 문서 다이얼로그
- 사전 화면
- ERD 편집기
- Markdown 편집기
- DDL import/export dialog

### 컴포넌트별

- Dialog
- DropdownMenu
- Select
- Popover
- Card
- Tabs
- Button

### 편집기

- `paper`/`graphite` = Monaco light
- `midnight` = Monaco dark
- ReactFlow canvas/validation/sidebar 대비 확인

## 14. 리스크

### 리스크 1. 테마는 바뀌는데 export HTML은 그대로

현재 [markdown.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/lib/markdown.ts) 의 export HTML은 앱 테마와 분리돼 있다.

대응:

- MVP에서는 “export는 문서 기본 테마 고정”으로 명시
- UI 테마와 export 테마를 분리 개념으로 둔다

### 리스크 2. dark class 의존 코드 분산

현재 Monaco theme 판단은 `useDarkMode` 기반이다.

대응:

- 1차는 `ThemeProvider`가 `.dark`를 제어
- 후속으로 `useTheme` 기반 공용 util로 정리

### 리스크 3. 임의 색상 추가로 토큰 무결성 붕괴

대응:

- theme key는 3개로 고정
- 색상 자유 선택 UI는 금지
- `DESIGN.md`를 정본으로 사용

## 15. 산출물

이번 계획의 산출물은 다음과 같다.

- `ThemeProvider` 기반 앱 전역 테마 런타임
- `ThemeSwitcher` 기반 사용자 선택 UI
- `paper / graphite / midnight` 3개 curated theme
- Monaco light/dark 연동
- 브라우저 QA 리포트

## 16. 구현 시작 기준

이 계획은 바로 구현 가능한 수준으로 본다.

다음 단계는:

1. `ThemeKey + ThemeProvider + ThemeSwitcher` 구현
2. `index.css` theme override 작성
3. 브라우저 QA
