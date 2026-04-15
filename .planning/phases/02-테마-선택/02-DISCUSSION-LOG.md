# Phase 2: 테마 선택 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 02-테마-선택
**Areas discussed:** 테마 디자인 방향, 전환 UI/UX, Monaco/ERD 캔버스 통합, 저장/복원 전략

---

## 테마 디자인 방향

| Option | Description | Selected |
|--------|-------------|----------|
| Paper=현재 :root, Midnight=현재 .dark, Graphite=새로 만들기 | 기존 2개 토큰을 살리고 Graphite만 새로 정의 | |
| 3개 모두 새로 디자인 | Paper, Graphite, Midnight 모두 새로 디자인. DESIGN.md 기반 색감 통일 | ✓ |
| Claude 재량 | 기술적으로 최적의 방법 선택 | |

**User's choice:** 3개 모두 새로 디자인
**Notes:** 기본 방향 — Paper=따뜻한 크림/아이보리, Graphite=시원한 그레이/서늘, Midnight=네이비/코발트 다크

---

## 전환 UI/UX

| Option | Description | Selected |
|--------|-------------|----------|
| 헤더 오른쪽 (Language 옆) | Language 토글 옆에 테마 아이콘 버튼. 3개 테마 드롭다운 | ✓ |
| 설정 페이지 | 별도 설정 페이지에서 테마 선택 | |
| 커맨드 팔레트 (Cmd+K) | 커맨드 팔레트에서 'theme' 검색하여 전환 | |

**User's choice:** 헤더 오른쪽 (Language 옆)

| Option | Description | Selected |
|--------|-------------|----------|
| 즉시 전환 (애니메이션 없음) | class 토글로 즉시 전환 | ✓ |
| 부드러운 fade 전환 | 200~300ms fade transition | |
| Claude 재량 | 기술적으로 적합한 방식 | |

**User's choice:** 즉시 전환 (애니메이션 없음)

---

## Monaco/ERD 캔버스 통합

| Option | Description | Selected |
|--------|-------------|----------|
| vs / vs-dark 내장 2개만 사용 | Paper=vs, Graphite=vs-dark, Midnight=vs-dark. 커스텀 없음 | ✓ |
| 테마별 커스텀 Monaco 테마 | 3개 테마에 맞는 커스텀 Monaco 테마 정의 | |
| Claude 재량 | 기술적 판단에 맡김 | |

**User's choice:** vs / vs-dark 내장 2개만 사용

---

## 저장/복원 전략

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage 만 | 브라우저 로컬에만 저장. 서버 변경 없음 | ✓ |
| 서버 사용자 설정 | User 엔티티에 theme 필드 추가 | |
| localStorage + 서버 동기화 | 빠른 복원 + 서버 동기화 | |

**User's choice:** localStorage 만

---

## Claude's Discretion

- Zustand 테마 스토어 구조
- CSS class 토글 구현 방식
- tailwind.config.js 확장 방식
- Electron 환경 테마 동기화

## Deferred Ideas

None
