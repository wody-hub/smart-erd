# Phase 2: 테마 선택 - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 Paper/Graphite/Midnight 3가지 큐레이션 테마 중 하나를 선택하면 앱 전역(ERD 캔버스, 마크다운 에디터, Dialog, Monaco)에 일관되게 적용되고 새로고침 후에도 유지된다.

자유 색상 커스터마이징은 범위 밖 — 큐레이션 테마만 제공.

</domain>

<decisions>
## Implementation Decisions

### 테마 디자인
- **D-01:** 3개 테마 모두 새로 디자인한다. 기존 `:root`(warm cream)와 `.dark`(navy) 토큰을 참고하되 3개 독립 토큰셋을 정의한다.
- **D-02:** 기본 색감 방향 — Paper=따뜻한 크림/아이보리, Graphite=시원한 그레이/서늘, Midnight=네이비/코발트 다크. 각각 독립된 primary accent color를 가진다.
- **D-03:** DESIGN.md에 테마별 토큰을 정의하고, `index.css`에 CSS Variable로 구현한다.

### 전환 UI/UX
- **D-04:** 헤더 오른쪽 Language 토글 옆에 테마 아이콘 버튼을 배치한다. 클릭 시 3개 테마 드롭다운 표시.
- **D-05:** 테마 전환은 즉시 적용한다. fade/transition 애니메이션 없음.

### Monaco/ERD 캔버스 통합
- **D-06:** Monaco 에디터는 내장 `vs`(light) / `vs-dark`(dark) 2개만 사용한다. Paper→vs, Graphite→vs-dark, Midnight→vs-dark 매핑. 커스텀 Monaco 테마 정의하지 않음.
- **D-07:** ERD 캔버스(React Flow) 및 ERD 전용 토큰(`--erd-*`)도 테마별로 CSS Variable이 전환되도록 한다.

### 저장/복원
- **D-08:** 테마 선택은 localStorage에만 저장한다. 서버 저장 없음, DB 변경 없음.
- **D-09:** 새로고침 시 localStorage에서 복원하고, 저장된 값이 없으면 기본 테마(Paper)를 적용한다.

### Claude's Discretion
- Zustand 테마 스토어 구조 (기존 useAuthStore 패턴 참고)
- CSS class 토글 구현 방식 (document.documentElement.classList)
- `tailwind.config.js` 확장 방식
- Electron 환경에서의 테마 동기화 (electron-store 활용 가능)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 디자인 시스템
- `DESIGN.md` — 프로젝트 디자인 시스템 정본. 테마 토큰 정의 시 기준
- `client/src/index.css` — 현재 CSS Variable 정의 (`:root` + `.dark`)
- `client/tailwind.config.js` — Tailwind 시맨틱 색상 매핑 (`darkMode: ["class"]`)

### 기존 코드 패턴
- `client/src/stores/useAuthStore.ts` — Zustand 스토어 패턴 참고 (localStorage 동기화)
- `client/src/constants/storage.ts` — STORAGE_KEYS 상수 정의 위치
- `client/src/components/layout/Header.tsx` — 테마 버튼 배치 위치

### ERD/Monaco 통합
- `client/src/components/erd/DslCodeEditorPanel.tsx` — Monaco `theme` prop 사용 (`isDark` 분기)
- `client/src/components/erd/TableNode.tsx` — ERD 전용 토큰 사용 패턴

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CSS Variable 토큰 시스템**: `:root` + `.dark`로 20+ 토큰 정의됨. 3개 테마로 확장 가능
- **Tailwind `darkMode: ["class"]`**: class 기반 토글 이미 설정됨
- **`STORAGE_KEYS` 상수**: localStorage 키 관리 패턴
- **shadcn/ui DropdownMenu**: 테마 선택 드롭다운에 재사용 가능
- **Zustand + localStorage**: `useAuthStore`에서 검증된 패턴

### Established Patterns
- 디자인 토큰: `index.css` CSS Variable → `tailwind.config.js` 매핑 → 시맨틱 클래스
- 하드코딩 색상 금지 — 모든 색상은 시맨틱 토큰 경유
- 아이콘 전용 버튼에 `aria-label` 필수

### Integration Points
- Header.tsx에 테마 토글 버튼 추가
- `index.css`에 3개 테마 CSS Variable 추가 (`.theme-paper`, `.theme-graphite`, `.theme-midnight`)
- Monaco 에디터 `theme` prop에 테마 매핑 연동
- Electron의 `electron-store`와 localStorage 동기화 (선택적)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-테마-선택*
*Context gathered: 2026-04-03*
