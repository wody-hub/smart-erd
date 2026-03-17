# 디자인 & 퍼블리셔 점검 체크리스트

점검 대상 파일에 해당하는 항목만 적용한다.

## 목차

- [1. 디자인 토큰 준수 (Critical)](#1-디자인-토큰-준수-critical)
- [2. 다크 모드 호환성 (Critical)](#2-다크-모드-호환성-critical)
- [3. 타이포그래피 일관성 (Medium)](#3-타이포그래피-일관성-medium)
- [4. 로딩 및 빈 상태 UI (Medium)](#4-로딩-및-빈-상태-ui-medium)
- [5. 접근성 - a11y (Medium)](#5-접근성---a11y-medium)
- [6. 컴포넌트 구조 (Low)](#6-컴포넌트-구조-low)
- [7. 반응형 (Low)](#7-반응형-low)
- [8. 함수 주석 정책 (Critical)](#8-함수-주석-정책-critical)

## 1. 디자인 토큰 준수 (Critical)

- [ ] `bg-gray-*`, `text-blue-*`, `text-green-*`, `#hex`, `rgb()` 등 하드코딩 색상을 사용하지 않는지 확인
- [ ] `bg-card`, `text-muted-foreground`, `border-border`, `bg-accent` 등 시맨틱 토큰 클래스를 사용하는지 확인
- [ ] ERD 컴포넌트에서 `bg-erd-*`, `text-erd-*`, `bg-header`, `text-header-*` 토큰을 사용하는지 확인
- [ ] hover/focus 상태에 시맨틱 토큰(`hover:bg-accent`, `focus:bg-accent`)을 사용하는지 확인
- [ ] MiniMap 등 색상 prop 전달 시 `hsl(var(--token))` 형식을 사용하는지 확인

## 2. 다크 모드 호환성 (Critical)

- [ ] 모든 색상이 CSS 변수 기반으로 적용되어 `.dark` 토글 시 자동 전환되는지 확인
- [ ] `index.css`의 `:root`와 `.dark`에 동일 토큰 세트가 정의되는지 확인
- [ ] 의미 없는 절대 색상(`white`, `black`) 사용을 피하는지 확인

## 3. 타이포그래피 일관성 (Medium)

- [ ] 동일 역할 텍스트에 동일 크기 클래스(예: 제목 `text-2xl font-bold`)를 사용하는지 확인
- [ ] heading/body/caption 계층의 크기 스케일이 일관적인지 확인
- [ ] `font-mono`를 코드/데이터 필드에만 제한해 사용하는지 확인

## 4. 로딩 및 빈 상태 UI (Medium)

- [ ] 로딩 상태에 `Spinner` 컴포넌트(`components/ui/spinner.tsx`)를 사용하는지 확인
- [ ] `<p>Loading...</p>` 같은 단순 텍스트 로딩 패턴을 피하는지 확인
- [ ] 빈 상태 패턴(Lucide 아이콘 + 안내 텍스트 + 액션 버튼)을 일관되게 사용하는지 확인

## 5. 접근성 - a11y (Medium)

- [ ] `size="icon"` 버튼에 `aria-label`이 모두 존재하는지 확인
- [ ] PK/FK/nullable 토글 `aria-label`에 대상 컨텍스트가 포함되는지 확인
- [ ] `<label>` 연결이 어려운 form 요소(input/select 등)에 `aria-label`을 제공하는지 확인
- [ ] 네이티브 `<input>`, `<button>`에 `focus-visible:ring` 또는 동등한 포커스 표시가 있는지 확인

## 6. 컴포넌트 구조 (Low)

- [ ] shadcn/ui 프리미티브 패턴(`forwardRef`, `cn()`, CVA`)을 준수하는지 확인
- [ ] 2회 이상 반복되는 UI 패턴을 공통 컴포넌트로 추출하는지 확인
- [ ] `components/ui/`에 도메인 로직이 포함되지 않는지 확인

## 7. 반응형 (Low)

- [ ] 카드 그리드에 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` 등 반응형 클래스를 적용하는지 확인
- [ ] ERD 편집기는 데스크톱 우선이더라도 최소 너비 깨짐이 없는지 확인

## 8. 함수 주석 정책 (Critical)

- [ ] 신규/수정 함수/메서드/핸들러/커스텀 훅에 멀티라인 JSDoc이 있는지 확인
- [ ] JSDoc에 최소 `@param`과 반환값 설명이 포함되는지 확인
