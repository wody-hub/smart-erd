# 디자인 & 퍼블리셔 점검자

전문 퍼블리셔 관점에서 프론트엔드 코드를 점검한다. 점검 대상은 `$ARGUMENTS`이다. 인자가 없으면 `client/src/` 전체를 대상으로 한다.

## 점검 절차

1. 먼저 `client/src/index.css`의 디자인 토큰 정의와 `client/tailwind.config.js`의 시맨틱 색상 매핑을 읽어 현재 토큰 체계를 파악한다.
2. 점검 대상 파일들을 읽고 아래 체크리스트를 기준으로 점검한다.
3. 점검 결과를 표 형식으로 정리하고, 위반 사항에는 **구체적인 파일:라인번호와 수정 제안**을 포함한다.

## 체크리스트

### 1. 디자인 토큰 준수 (Critical)

- [ ] **하드코딩 색상 금지**: `bg-gray-*`, `text-blue-*`, `text-green-*`, `#hex`, `rgb()` 등 Tailwind 기본 팔레트 직접 사용이 없는지 확인
- [ ] **시맨틱 토큰 사용**: `bg-card`, `text-muted-foreground`, `border-border`, `bg-accent` 등 CSS Variable 기반 시맨틱 클래스를 사용하고 있는지 확인
- [ ] **ERD 전용 토큰 사용**: ERD 관련 컴포넌트(TableNode, Header, Sidebar, ERDCanvas)에서 `bg-erd-*`, `text-erd-*`, `bg-header`, `text-header-*` 토큰을 사용하고 있는지 확인
- [ ] **인터랙션 상태**: hover/focus 상태에 `hover:bg-accent`, `focus:bg-accent` 등 시맨틱 토큰을 사용하는지 확인
- [ ] **prop 색상 전달**: MiniMap 등 prop으로 색상을 전달하는 곳에서 `hsl(var(--token))` 형식을 사용하는지 확인

### 2. 다크 모드 호환성 (Critical)

- [ ] 모든 색상이 CSS Variable을 통해 적용되어 `.dark` 클래스 토글 시 자동 전환되는지 확인
- [ ] `index.css`에 `:root`와 `.dark` 양쪽에 동일한 토큰 세트가 정의되어 있는지 확인
- [ ] `white`, `black` 등 절대 색상이 시맨틱 의미 없이 사용되고 있지 않은지 확인

### 3. 타이포그래피 일관성 (Medium)

- [ ] 동일한 역할의 텍스트가 동일한 크기 클래스를 사용하는지 확인 (예: 페이지 제목은 모두 `text-2xl font-bold`)
- [ ] heading, body, caption 등 텍스트 역할별 크기가 일관적인지 확인
- [ ] `font-mono`가 코드/데이터 필드에만 적절히 사용되는지 확인

### 4. 로딩 / 빈 상태 UI (Medium)

- [ ] 로딩 상태에 `Spinner` 컴포넌트(`components/ui/spinner.tsx`)를 사용하는지 확인
- [ ] `<p>Loading...</p>` 등 단순 텍스트만 표시하는 곳이 없는지 확인
- [ ] 빈 상태에 Lucide 아이콘 + 안내 텍스트 + 액션 버튼 패턴이 일관적으로 적용되는지 확인

### 5. 접근성 — a11y (Medium)

- [ ] **아이콘 전용 버튼**: 모든 `size="icon"` 버튼에 `aria-label`이 있는지 확인
- [ ] **토글 버튼**: PK/FK/nullable 등 토글에 `aria-label`이 대상 컨텍스트를 포함하는지 확인
- [ ] **input/select**: `<label>` 연결이 불가능한 form 요소에 `aria-label`이 있는지 확인
- [ ] **focus ring**: 네이티브 `<input>`, `<button>`에 `focus-visible:ring` 또는 동등한 포커스 표시가 있는지 확인

### 6. 컴포넌트 구조 (Low)

- [ ] shadcn/ui 프리미티브 패턴 준수: `forwardRef`, `cn()`, CVA
- [ ] 2회 이상 반복되는 UI 패턴이 공유 컴포넌트로 추출되어 있는지 확인
- [ ] `components/ui/`에 도메인 로직이 포함되어 있지 않은지 확인

### 7. 반응형 (Low)

- [ ] 카드 그리드에 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` 등 반응형 클래스가 적용되는지 확인
- [ ] ERD 편집기는 데스크톱 도구이므로 모바일 대응 불필요, 단 최소 너비 깨짐이 없는지 확인

## 출력 형식

```markdown
## 디자인 & 퍼블리셔 점검 결과

### 요약
| 영역 | 상태 | 위반 수 |
|------|------|---------|
| 디자인 토큰 | ✅ / ⚠️ / ❌ | N |
| 다크 모드 | ... | ... |
| ... | ... | ... |

### 위반 상세
#### [영역명]
| 파일:라인 | 현재 코드 | 수정 제안 | 심각도 |
|-----------|-----------|-----------|--------|
| `Header.tsx:42` | `bg-gray-900` | `bg-header` | Critical |
| ... | ... | ... | ... |

### 총평
(1-2문장으로 전체 상태 요약)
```
