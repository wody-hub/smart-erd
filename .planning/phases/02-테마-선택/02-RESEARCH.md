# Phase 2: 테마 선택 - Research

**Researched:** 2026-04-03
**Domain:** curated theme system, CSS variable token rollout, Zustand persistence, Monaco theme mapping
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Paper / Graphite / Midnight 3개 테마를 모두 새로 디자인한다.
- **D-02:** Paper=따뜻한 크림/아이보리, Graphite=서늘한 회색/슬레이트, Midnight=네이비/코발트 다크 방향을 유지한다.
- **D-03:** `DESIGN.md`와 `client/src/index.css`에 테마 토큰을 정의한다.
- **D-04:** 헤더 오른쪽, Language 전환기 왼쪽에 테마 버튼을 둔다.
- **D-05:** 전환은 즉시 적용한다. fade/transition 애니메이션은 넣지 않는다.
- **D-06:** Monaco는 커스텀 테마를 만들지 않고 `vs` / `vs-dark`만 사용한다.
- **D-07:** ERD 캔버스 토큰(`--erd-*`)도 테마 전환에 따라 함께 바뀌어야 한다.
- **D-08:** 저장은 localStorage만 사용한다. 서버/DB 변경은 없다.
- **D-09:** 저장값이 없거나 잘못됐으면 기본값은 `Paper`다.

### Claude's Discretion

- Zustand 스토어 구조
- DOM class 토글 방식
- `useDarkMode()` 마이그레이션 방식
- Tailwind / CSS token 보강 범위
- Electron 환경에서의 persistence 처리 수준

### Deferred Ideas (OUT OF SCOPE)

- 자유 색상 커스터마이징
- 서버 사용자 설정 저장
- Monaco 커스텀 테마 정의

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| THEME-01 | 사용자가 헤더에서 Paper/Graphite/Midnight 테마를 선택할 수 있다 | `Header.tsx`에 `ThemeSwitcher`를 추가하고 `shadcn/ui` `DropdownMenu`를 사용하면 기존 header utility rail과 자연스럽게 결합된다 |
| THEME-02 | 선택한 테마가 앱 전역(ERD, 마크다운, Dialog, Monaco)에 일관되게 적용된다 | 현재 UI가 대부분 CSS variable + Tailwind semantic token 기반이라 `index.css`의 theme class 전개만으로 ERD/markdown/dialog는 자동 적용 가능하고, Monaco는 `useDarkMode()` 경유 `vs/vs-dark` 매핑만 정리하면 된다 |
| THEME-03 | 새로고침 후에도 선택한 테마가 유지된다 | `STORAGE_KEYS` + Zustand 초기화 패턴으로 localStorage persistence 가능. 앱 부트스트랩 전에 DOM class를 적용하면 refresh flash를 줄일 수 있다 |

</phase_requirements>

---

## Summary

현재 코드베이스에는 실제 테마 시스템이 없고, `client/src/index.css`의 `:root` + `.dark` 두 토큰셋과 `client/src/hooks/useDarkMode.ts`만 존재한다. 검색 결과 `.dark` 클래스를 직접 읽는 곳은 `useDarkMode()` 하나뿐이고, Tailwind의 `dark:` variant 사용도 없다. 이 말은 곧 Phase 2의 핵심 작업이 "전역 토큰 구조를 3 curated themes로 확장"하고, "기존 Monaco dark/light 분기만 새 파생값으로 연결"하는 것이라는 뜻이다.

실제 영향 범위는 다음과 같다.

1. **토큰 계층**
   - `client/src/index.css`의 `:root` / `.dark`를 `:root` / `.theme-paper` / `.theme-graphite` / `.theme-midnight` 구조로 재편해야 한다.
   - Paper는 기존 warm theme를 유지하되 명시 클래스 `.theme-paper`도 제공하는 편이 안전하다.
   - Graphite는 `02-UI-SPEC.md`에 제시된 신규 token table을 그대로 반영해야 한다.
   - Midnight는 현재 `.dark` 토큰을 `.theme-midnight`로 이전하면 된다.

2. **상태 및 부트스트랩**
   - `client/src/constants/storage.ts`에 새 localStorage key가 필요하다.
   - `client/src/stores/useAuthStore.ts` 패턴을 따라 `useThemeStore.ts`를 추가할 수 있다.
   - refresh 직후 첫 paint 전에 `document.documentElement`에 theme class를 적용하지 않으면 theme flash가 생길 수 있으므로 `client/src/main.tsx`에서 초기화하는 것이 가장 안전하다.

3. **외부 라이브러리 연결**
   - Monaco는 이미 `useDarkMode()`의 boolean만 보고 `vs` / `vs-dark`를 선택한다.
   - 따라서 `useDarkMode()`를 store 기반 `isDark(theme === 'graphite' || theme === 'midnight')`로 바꾸면 `DslCodeEditorPanel.tsx`, `DdlCodeEditorPanel.tsx`, `DdlImportDialog.tsx`, `DdlExportDialog.tsx`가 추가 수정 없이 새 정책을 따른다.
   - ERD, markdown, dialog는 CSS variable 기반이므로 `index.css` 토큰 rollout이 핵심이다.

4. **UI 및 i18n**
   - `Header.tsx`의 utility rail에 LanguageSwitcher가 이미 존재하므로, 바로 왼쪽에 `ThemeSwitcher.tsx`를 추가하는 구조가 자연스럽다.
   - 현재 번역 리소스(`client/src/i18n/locales/{ko,en}/translation.json`)에는 `theme.*` 네임스페이스가 아직 없다.

**Primary recommendation:** 3개 plan, 2개 wave로 나눈다.
- Wave 1: theme foundation (`lib/theme.ts`, `useThemeStore.ts`, storage key, DOM bootstrap, `useDarkMode()` 마이그레이션)
- Wave 2 병렬:
  - global token rollout (`DESIGN.md`, `index.css`)
  - header theme switcher + i18n

이 구조면 THEME-02/03의 기반을 먼저 고정하고, 이후 styling/UI 작업을 병렬 실행할 수 있다.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | ^5.0.0 | theme state + persistence orchestration | 이미 auth/canvas 계층에서 사용 중인 상태관리 패턴 |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 | theme switcher dropdown | `LanguageSwitcher`와 동일한 UI 패턴 재사용 가능 |
| `lucide-react` | ^0.563.0 | `Palette`, `Check` icon | 기존 아이콘 시스템과 일관 |
| CSS variables + Tailwind semantic colors | existing | app-wide theme propagation | 현재 UI 대부분이 이미 semantic token 기반 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `electron-store` | ^11.0.2 | Electron native persistence fallback | 이번 phase에서는 optional. localStorage-only 결정이 우선 |
| Node test infra | existing | pure helper/store regression tests | theme helper/unit 테스트용 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand theme store | React Context only | 현재 프로젝트 상태관리 패턴과 멀어지고 persistence/hydration 코드가 페이지별로 분산된다 |
| custom Monaco themes | `monaco.editor.defineTheme()` | D-06과 충돌. 설계/검증 범위를 불필요하게 확장한다 |
| server-side preference | user profile API / DB column | D-08과 정면 충돌. backend scope 증가 |

---

## Architecture Patterns

### Current Codebase Facts (direct inspection)

**Theme state**
- `client/src/hooks/useDarkMode.ts`만이 `document.documentElement.classList.contains('dark')`를 감시한다.
- `.dark`를 직접 add/remove/toggle하는 코드가 없다.
- `dark:` Tailwind variant 사용도 없다.

**Monaco integration**
- 다음 파일들이 `useDarkMode()` → `theme={isDark ? 'vs-dark' : 'vs'}` 패턴을 쓴다.
  - `client/src/components/erd/DslCodeEditorPanel.tsx`
  - `client/src/components/erd/DdlCodeEditorPanel.tsx`
  - `client/src/components/erd/DdlImportDialog.tsx`
  - `client/src/components/erd/DdlExportDialog.tsx`

**Header integration**
- `client/src/components/layout/Header.tsx`의 `header-utility-group` 안에 `LanguageSwitcher`와 Electron settings button이 있다.
- 테마 버튼은 같은 group에 넣는 것이 가장 자연스럽다.

**Persistence pattern**
- `client/src/constants/storage.ts`에 localStorage key가 중앙화돼 있다.
- `client/src/stores/useAuthStore.ts`는 Zustand store가 직접 localStorage와 동기화하는 단순 패턴을 사용한다.

**Electron**
- `client/electron/main/settings-store.ts`는 serverUrl, windowBounds만 저장한다.
- renderer에는 `window.electronAPI.getServerUrl/setServerUrl`만 노출돼 있다.
- D-08이 localStorage-only이므로 Phase 2에서 Electron IPC를 넓힐 필요는 없다.

### Recommended Project Structure

```
client/src/
├── lib/
│   └── theme.ts                     # Theme type, class map, helper functions
├── stores/
│   └── useThemeStore.ts            # theme state + persistence
├── components/layout/
│   └── ThemeSwitcher.tsx           # header dropdown UI
└── hooks/
    └── useDarkMode.ts              # store-driven wrapper로 전환
```

### Pattern 1: Pure Theme Helper Layer

**What:** class names, storage parsing, Monaco mapping, dark-mode derivation을 pure helper로 모은다.
**When to use:** store, bootstrap, unit tests, UI 모두 동일 규칙을 공유해야 할 때

```ts
export type ThemeName = 'paper' | 'graphite' | 'midnight';

export const DEFAULT_THEME: ThemeName = 'paper';

export function resolveStoredTheme(value: string | null | undefined): ThemeName;
export function isDarkTheme(theme: ThemeName): boolean;
export function resolveMonacoTheme(theme: ThemeName): 'vs' | 'vs-dark';
export function applyThemeClass(target: HTMLElement, theme: ThemeName): void;
```

**Why:** `useDarkMode()`가 boolean만 필요로 하고, `Header`는 label/swatch/UI만 필요로 하며, bootstrap은 DOM class만 필요로 한다. 이 규칙을 한 파일에 모으면 구현과 테스트가 단순해진다.

### Pattern 2: Bootstrap Before React Render

**What:** `client/src/main.tsx`에서 `createRoot()` 전에 저장된 theme를 읽고 `document.documentElement` class를 설정한다.
**When to use:** refresh/reopen 시 first paint flash를 줄여야 할 때

```ts
const initialTheme = resolveStoredTheme(localStorage.getItem(STORAGE_KEYS.THEME));
applyThemeClass(document.documentElement, initialTheme);
```

이후 React mount 후 `useThemeStore()`는 같은 값을 재사용하면 된다.

### Pattern 3: `useDarkMode()` as Compatibility Adapter

**What:** 현재 Monaco consumer들을 직접 고치지 않고, `useDarkMode()` 내부 구현만 store 기반으로 바꾼다.
**When to use:** 영향 파일 수를 줄이고 `vs/vs-dark` 매핑을 한 곳에서 제어할 때

```ts
export function useDarkMode(): boolean {
  return useThemeStore((state) => state.isDark);
}
```

**Why:** 검색 결과 `useDarkMode()` 소비자는 Monaco 관련 4곳뿐이다. hook만 바꾸면 Graphite/Midnight는 자동으로 dark Monaco, Paper는 light Monaco가 된다.

### Pattern 4: CSS Theme Classes Instead of `.dark`

**What:** `index.css`에서 `.dark`를 authoritative selector로 쓰지 않고 `.theme-paper`, `.theme-graphite`, `.theme-midnight` 3개 selector를 explicit하게 둔다.
**When to use:** curated multi-theme system에서 light/dark 이분법을 넘어서야 할 때

**Recommended selector hierarchy:**

```css
:root,
.theme-paper { ...Paper tokens... }

.theme-graphite { ...Graphite tokens... }

.theme-midnight { ...current dark tokens migrated... }
```

`body` gradient는 theme class가 바뀌면 variable만 따라가도록 유지한다.

---

## Validation Architecture

### Automated

1. **Pure helper/unit tests**
   - 새 파일 `client/test/unit/theme-config.test.ts`
   - 검증 대상:
     - invalid storage value fallback → `paper`
     - `graphite`, `midnight` only → `isDarkTheme === true`
     - Monaco mapping → `paper => vs`, `graphite/midnight => vs-dark`
     - helper class map contains `theme-paper`, `theme-graphite`, `theme-midnight`

2. **Build verification**
   - `cd client && npm run build`
   - CSS selector, Header wiring, i18n key additions, Zustand imports까지 포함한 통합 compile gate

### Manual

1. **Header switcher behavior**
   - Header icon click → dropdown opens → current theme item highlighted

2. **Visual propagation**
   - Teams / Projects / Diagrams / Document editor / Dictionary / Dialog에서 배경·surface·border·text tone이 바뀌는지 확인

3. **Monaco propagation**
   - DSL / DDL editor가 Paper에서는 `vs`, Graphite/Midnight에서는 `vs-dark`로 렌더링되는지 확인

4. **Persistence**
   - theme 변경 후 reload/reopen 시 동일 theme 유지

### Recommended Commands

- Quick: `cd client && npm run test:unit 2>&1 | grep -E "theme-config|pass|ok"`
- Full: `cd client && npm run build`

---

## Pitfalls

### Pitfall 1: `.dark`를 완전히 제거하지 않고 중간 상태를 남기는 경우

`useDarkMode()`가 `.dark`를 계속 보면 Graphite가 dark Monaco로 매핑되지 않는다. `.dark` 감시 기반 구현은 반드시 제거하거나 compatibility wrapper로 치환해야 한다.

### Pitfall 2: `main.tsx` 이전에 theme class를 적용하지 않는 경우

store hydration을 React effect에서만 하면 새로고침 직후 Paper→Midnight flash가 생길 수 있다. bootstrap 적용이 더 안전하다.

### Pitfall 3: Graphite를 “light-ish gray”로 구현하는 경우

Monaco는 Graphite를 `vs-dark`로 써야 하므로 Graphite token table도 dark-friendly contrast를 가져야 한다. `02-UI-SPEC.md` 값을 그대로 사용하는 것이 안전하다.

### Pitfall 4: Electron native store를 phase scope 안으로 끌어들이는 경우

현재 요구사항은 localStorage-only다. Electron IPC/API를 넓히면 scope가 커지고 테스트 축이 늘어난다. localStorage persistence로 충분하다.

### Pitfall 5: hard-coded color 보완 없이 새 토큰만 추가하는 경우

대부분 화면은 semantic token 기반이지만, header utility/ERD badge 등 일부 요소는 visually 민감하다. token rollout 후 주요 page/component spot-check가 필요하다.

---

## Planning Implications

- **Plan 01 (Wave 1):** foundation 먼저 고정해야 한다. theme type/helper/store/bootstrap/useDarkMode를 여기서 끝내야 이후 styling/UI plan이 안전하다.
- **Plan 02 (Wave 2):** token rollout은 `DESIGN.md` + `index.css` 중심으로 묶는 것이 맞다. 이 plan에서 THEME-02의 대부분이 해결된다.
- **Plan 03 (Wave 2):** ThemeSwitcher + i18n + Header integration은 foundation만 의존하므로 token rollout과 병렬 가능하다.
- **No backend plan needed:** Phase 2는 frontend-only로 끝낼 수 있다.

---

_Research synthesized locally after gsd-phase-researcher timeout fallback._
