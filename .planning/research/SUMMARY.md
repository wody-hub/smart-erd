# Project Research Summary

**Project:** Smart-ERD — SI 프로젝트 관리 기능 추가 (WBS, 마일스톤, 간트, 인력·비용, 보고서)
**Domain:** 한국 SI 프로젝트 관리 플랫폼 (기존 ERD 협업 도구 확장)
**Researched:** 2026-04-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

Smart-ERD는 기존 ERD 설계 협업 도구에 한국 SI 현장 맞춤형 PM 기능을 추가하는 확장 프로젝트다. 한국 SI 업계는 M/M(맨먼스) 기반 비용 계약, 단계별 산출물 납품, 발주처 주간·월간 보고 의무라는 고유한 구조를 갖는다. 기존 Jira·MS Project는 이 구조와 맞지 않고 Excel이 여전히 실질적 표준으로 사용된다는 점에서 통합 플랫폼의 차별점이 명확하다. 구현 전략은 기존 스택(Spring Boot 3.5.11, React 19, PostgreSQL 17, Yjs)에 최소한의 라이브러리만 추가해 리스크를 낮추는 방향이 옳다.

권장 접근 방식은 아키텍처 연구가 도출한 4단계 Build Order를 그대로 따르는 것이다. 사업 개요(프로젝트 메타 확장)부터 시작해 WBS + 마일스톤 + 간트(일정 코어), 인력·비용(M/M 관리), 이슈 트래커 + 보고서(집계·보고) 순서로 구현한다. 각 단계가 다음 단계의 데이터 선행 조건이 되므로 이 순서를 바꾸면 의존성 충돌이 발생한다. PM 기능은 Yjs 실시간 협업 없이 REST + 낙관적 잠금으로 충분하며, Yjs는 기존 문서(ERD·마크다운) 편집에만 유지한다.

핵심 리스크는 세 가지다. 첫째, WBS 계층 구조 DB 모델 선택 오류(adjacency list 단순 적용 시 성능 저하)로 초기 설계 시 `ltree` 패턴 도입이 필수다. 둘째, 기능 범위 과팽창(Second System Effect)으로 크리티컬 패스 계산·자원 평탄화·EVM은 명시적으로 Out of Scope 처리해야 한다. 셋째, 간트 차트 직접 Canvas 구현 시도는 2~4주 추가 비용을 낳으므로 `@svar-ui/react-gantt` (MIT, React 19 지원)를 사용한다.

---

## Key Findings

### 추천 스택

기존 스택에 5개 라이브러리만 추가한다. 간트 차트에는 `@svar-ui/react-gantt 2.6.1` (MIT, React 19 공식 지원, 의존성 드래그·계층 구조 무료 포함)을 선택한다. 기존 TanStack 생태계와 일관성을 유지하기 위해 WBS 계층 그리드는 `@tanstack/react-table 8.21.3`을 사용하고, 기존 `@dnd-kit`으로 행 재정렬을 처리한다. 인력·비용 차트는 `recharts 3.8.1` (SVG 기반, React 19 지원), 비용 입력은 `react-number-format 5.x`, 날짜 계산은 `date-fns 4.x`를 사용한다. 서버 PDF 보고서는 AGPL 제약이 없는 `openpdf 3.0.3` (LGPL/MPL)을 사용하고 클라이언트 PDF(`jspdf`)와 역할을 분리한다. iText 7은 AGPL 라이선스 문제로 사용 금지다.

**핵심 추가 기술:**
- `@svar-ui/react-gantt 2.6.1`: 간트 시각화 — MIT, React 19 공식 지원, 무료 버전에 핵심 기능 완비
- `@tanstack/react-table 8.21.3`: WBS 계층 그리드 — 기존 TanStack 생태계 일관성, `getSubRows` 트리 지원
- `recharts 3.8.1`: 인력·비용 차트 — React 19 지원, SVG 기반 Electron 호환
- `openpdf 3.0.3`: 서버 PDF 보고서 — LGPL/MPL, iText 7 AGPL 제약 없음
- `date-fns 4.x`: 날짜 계산 — 타임존 독립, tree-shaking 우위

### 기능 목록

한국 SI 업계 특성상 M/M 기반 비용 구조, 발주처 보고 의무, 산출물 검수 체계가 핵심 요건이다. Excel·MS Project가 현장 표준이지만 실시간 협업·ERD 통합 측면에서 명확한 차별점을 가진다.

**반드시 있어야 하는 기능 (v1 MVP):**
- 사업 개요 — 발주처·계약 기간·계약 금액 등 PM 컨텍스트 기반
- WBS 편집 — 계층 작업 분해, 담당자, 기간, 진척률, M/M
- 간트 차트 시각화 — WBS 기반 타임라인, 발주처 보고 첨부용
- 마일스톤 관리 — 계약 이정표, 완료 판정 로직
- 인력 투입 계획·실적 — M/M 계획/실적 매트릭스, 비용 근거
- 이슈 트래커 — 등록·담당자·상태·우선순위, 검수 미결 목록

**경쟁 우위 기능 (v1.x):**
- 주간·월간 보고서 — WBS·이슈 데이터 자동 집계, 발주처 보고 형식
- 산출물 체계 — 분석/설계/구현/시험/전개 단계별 상태 관리
- 변경 관리 로그 — 범위·일정 변경 이력, 분쟁 예방 증거
- ERD ↔ 산출물 직접 연결 — 기존 Diagram 시스템과 통합

**v2+로 이연:**
- 요구사항 추적 매트릭스 (RTM) — 공공 SI 특화, 구현 복잡도 높음
- 보고서 완전 자동 집계 — 데이터 구조 안정화 후 가능
- 비용 시뮬레이션 — 노임단가 외부 데이터 연동 필요
- 크리티컬 패스·자원 평탄화·EVM — 명시적 Out of Scope

### 아키텍처 접근

기존 `domain/` 패키지 구조를 확장해 `domain/pm/` (wbs·milestone·resource·budget), `domain/report/`, `domain/issue/` 서브패키지를 추가한다. 보고서 본문은 기존 `Diagram` 엔티티(마크다운 플러그인)를 재사용하고 `Report` 메타 엔티티가 이를 참조하는 방식으로, 마크다운 에디터·실시간 협업·템플릿 시스템을 무료로 활용한다. WBS 계층 구조는 인접 리스트보다 `ltree` 패턴(PostgreSQL 확장)을 초기부터 사용해 서브트리 조회 성능을 보장한다.

**주요 컴포넌트:**
1. `domain/pm/wbs` — WBS 작업 트리, 진척률 자동 롤업 (`ltree` 또는 closure table)
2. `domain/pm/milestone` — 마일스톤, WBS 완료 연동 판정, Diagram 산출물 참조
3. `domain/pm/resource` — M/M 계획·실적, TeamMember 참조
4. `domain/report` — WBS·이슈·인력 집계 소비, Diagram 기반 보고서 생성
5. `domain/issue` — 경량 상태 머신 이슈 트래커 (OPEN→IN_PROGRESS→RESOLVED→CLOSED)
6. `client/components/pm/` — WbsTree, GanttChart, ResourceTable, MilestoneTimeline

### 핵심 함정

1. **WBS adjacency list 단순 적용** — `parent_id` FK만으로 구현하면 서브트리 쿼리에 재귀 CTE가 필수가 되어 depth 증가에 따라 성능 저하. `ltree` 확장 컬럼으로 path 기반 인덱스 스캔(`path <@ '1.2'`)을 초기부터 적용한다.

2. **간트 날짜 타임존 버그** — REST API 응답이 UTC인데 브라우저가 로컬 타임으로 렌더링하면 KST(+09:00)에서 날짜 경계 오차 발생. WBS 시작·종료일 컬럼은 `DATE` 타입(timestamptz 아님)으로, 프론트는 `date-fns` 타임존 독립 함수만 사용한다.

3. **기능 범위 과팽창 (Second System Effect)** — SI 현장 경험이 많을수록 "불편했던 모든 것"을 넣으려는 충동. 단계별 진입 시 "반드시 있어야 하는 것" vs "있으면 좋은 것"을 명시적으로 구분하고, Out of Scope 목록을 운영한다.

4. **간트 차트 직접 Canvas 구현** — ERD 캔버스 경험에서 비롯된 자신감으로 직접 구현하면 줌·스크롤·드래그 인터랙션 구현에 2~4주 추가 소요. `@svar-ui/react-gantt` MIT 라이브러리를 선택한다.

5. **인력 투입 모델 과설계** — 완전 정규화 스키마(5개 이상 FK)는 입력 UI가 3단계 이상 드릴다운이 됨. MVP는 `(team_member_id, year_month, planned_mm, actual_mm, unit_cost)` 플랫 테이블로 시작한다.

---

## 로드맵 시사점

아키텍처 연구의 Build Order와 피처 의존성 분석을 종합하면 4단계 구조가 최적이다.

### Phase 1: 사업 개요 + 프로젝트 메타 확장
**근거:** 모든 PM 기능의 컨텍스트를 제공하는 선행 조건. 발주처·계약 기간·계약 금액 없이는 WBS 기간·비용 설정이 불가능하다. 구현 비용이 낮아 PM 기능의 진입점으로 적합.
**산출물:** Project 엔티티 메타 확장, 사업 개요 UI, 프로젝트 헤더 표시
**대상 기능:** 사업 개요 (FEATURES.md P1)
**회피 함정:** 과설계 방지 — 이 단계에서 비용·인력 필드까지 설계하지 않는다

### Phase 2: WBS 코어 + 마일스톤
**근거:** 간트·인력·보고서 모두 WBS 데이터에 의존한다. WBS가 없으면 간트 렌더링 불가, 보고서 집계 불가. 마일스톤은 WBS 완료 연동 검증이 있어 WBS 이후 구현한다.
**산출물:** WbsItem 엔티티(`ltree`), 재귀 조회, 진척률 롤업, Milestone 엔티티, WBS 편집 UI, 마일스톤 타임라인
**대상 기능:** WBS 편집, 마일스톤 관리 (FEATURES.md P1)
**사용 기술:** `@tanstack/react-table` + `@dnd-kit` (기존), PostgreSQL `ltree` 확장
**회피 함정:** adjacency list 대신 `ltree` 초기 적용 (PITFALLS.md Pitfall 1)

### Phase 3: 간트 차트 시각화
**근거:** WBS API 완성 후 프론트엔드만 구현하는 단계. 백엔드 신규 개발 없이 기존 WBS 데이터를 시각화한다. 간트는 읽기 전용 시각화부터 시작해 드래그 편집은 다음 이터레이션으로 분리한다.
**산출물:** GanttChart 컴포넌트, WBS→간트 어댑터 레이어, 타임라인 줌
**대상 기능:** 간트 차트 시각화 (FEATURES.md P1)
**사용 기술:** `@svar-ui/react-gantt 2.6.1`, `date-fns 4.x`
**회피 함정:** 직접 Canvas 구현 금지 (PITFALLS.md Pitfall 5), 날짜 `DATE` 타입 + 타임존 독립 계산 (PITFALLS.md Pitfall 2)

### Phase 4: 인력 투입 (M/M) + 비용 관리
**근거:** TeamMember 참조 기반이므로 Team/Project 기반 완성 후 구현. 월간 보고서의 M/M 현황 집계 소스가 되므로 보고서보다 선행해야 한다.
**산출물:** ResourcePlan 엔티티 (플랫 구조), BudgetItem 엔티티, 인력 투입 매트릭스 UI, 비용 현황 UI
**대상 기능:** 인력 투입 계획·실적, 비용 관리 (FEATURES.md P1)
**사용 기술:** `react-number-format 5.x` (비용 입력), `recharts 3.8.1` (차트)
**회피 함정:** 플랫 테이블 구조 유지 (PITFALLS.md Pitfall 6), 단가 이력 테이블 초기 미도입

### Phase 5: 이슈 트래커 + 주간·월간 보고서
**근거:** 이슈 트래커는 독립 도메인이지만 보고서 집계 소스로 활용된다. 보고서는 WBS·인력·이슈 데이터가 모두 준비된 후 마지막에 구현한다. 보고서 본문은 기존 Diagram(마크다운 플러그인)을 재사용해 에디터·협업 구현 비용을 절감한다.
**산출물:** Issue 엔티티·상태 머신, 이슈 트래커 UI, Report 메타 엔티티, 주간·월간 보고서 집계·생성, openpdf PDF 내보내기
**대상 기능:** 이슈 트래커, 주간·월간 보고서 (FEATURES.md P1~P2)
**사용 기술:** `openpdf 3.0.3` (서버 PDF), 기존 마크다운 플러그인 (Diagram 재사용)
**회피 함정:** 보고서 자동생성 과욕 방지 — 수동 편집 가능 반자동 집계부터 시작 (PITFALLS.md Pitfall 3), 보고서 본문을 별도 엔티티로 완전 분리하지 않음 (ARCHITECTURE.md Anti-Pattern 2)

### Phase 6: 산출물 체계 + 변경 관리 로그
**근거:** 이슈·보고서가 안정화된 후 SI 검수 체계를 완성한다. 기존 Diagram/Document 연결 시스템 위에 구축하므로 의존성이 명확하다.
**산출물:** 단계별 산출물 목록 + 상태 대시보드, 변경요청 → 승인 → WBS 반영 플로우
**대상 기능:** 산출물 체계, 변경 관리 로그 (FEATURES.md P2)

### 페이즈 순서 근거

- **의존성 기반 순서:** 사업 개요 → WBS → 간트 → 인력 → 이슈+보고서 순서는 ARCHITECTURE.md Build Order와 FEATURES.md Feature Dependencies가 일치하는 결론이다. 어떤 단계도 이전 단계 없이 독립 구현이 불가능하다.
- **WBS 설계 선행 결정:** Pitfall 1(ltree vs adjacency list)은 WBS 첫 구현 시점에 결정해야 하며, 이후 변경 시 마이그레이션 비용이 HIGH다.
- **간트를 WBS와 분리:** 간트는 백엔드 신규 없는 순수 프론트엔드 단계로 분리해 라이브러리 스파이크(POC)를 별도 진행하고 리스크를 격리한다.
- **보고서를 마지막으로:** 집계 소스(WBS·인력·이슈)가 모두 안정화되어야 보고서 자동 집계가 의미 있다. 데이터 없이 보고서 UI 먼저 구현하면 버려질 코드가 생긴다.

### 리서치 플래그

단계별 심화 리서치가 필요한 구간:
- **Phase 2 (WBS 설계):** PostgreSQL `ltree` 확장 + Spring Data JPA 연동 패턴, 재귀 CTE 없는 QueryDSL Native Query 구성 방법 — 공식 사례 드물음
- **Phase 3 (간트):** `@svar-ui/react-gantt` 실제 통합 패턴, WBS→GanttTask 어댑터 구조, Tailwind CSS Variable 테마 적용 가능 여부 — 실제 사용 사례 문서 부족
- **Phase 5 (보고서 PDF):** `openpdf 3.0.3` 패키지명 변경(`org.openpdf`) 및 Spring Boot 3.5 통합 호환성 검증 필요

표준 패턴으로 리서치 생략 가능:
- **Phase 1 (사업 개요):** Spring Data JPA 엔티티 필드 추가 + React Query 폼 — 기존 코드베이스와 동일한 패턴
- **Phase 4 (인력 투입):** 플랫 테이블 CRUD + `react-number-format` — 문서화 충분
- **Phase 6 (산출물 체계):** 기존 Diagram·Document 시스템 확장 — 코드베이스 내 패턴 확립

---

## 신뢰도 평가

| 영역 | 신뢰도 | 비고 |
|------|--------|------|
| 스택 | HIGH | React 19·Java 25 공식 지원 라이브러리 직접 확인. iText AGPL 문제, openpdf 패키지명 변경 등 실제 이슈 검증 완료 |
| 기능 | MEDIUM | 한국 SI 업계 실무 패턴 + KOSA/CISP 공식 가이드 기반. 공개 1차 자료 일부 부족 |
| 아키텍처 | HIGH | 기존 코드베이스 분석 + PMI PMBOK 표준 패턴 + PostgreSQL 공식 문서 기반 |
| 함정 | MEDIUM | 도메인별 공식 사례 + 커뮤니티 패턴 기반. 1인 개발 SI 툴 전용 직접 출처 부족 |

**전체 신뢰도: MEDIUM-HIGH**

### 해소가 필요한 갭

- **ltree + Spring Data JPA 연동:** PostgreSQL `ltree` 타입을 JPA `@Type`으로 매핑하는 방법이 프로젝트 내 전례 없음 — Phase 2 진입 전 스파이크 필요
- **`@svar-ui/react-gantt` 테마 호환:** Tailwind CSS Variable 기반 디자인 토큰과 간트 라이브러리 스타일 충돌 여부 — Phase 3 진입 전 POC 필요
- **WBS 동시 편집 충돌:** REST + 낙관적 잠금(version 필드 + 409)으로 충분한지 실제 다중 사용자 시나리오 검증 필요 — Phase 2 구현 중 확인
- **openpdf 3.0.3 Spring Boot 3.5 호환:** v3.0.0 패키지명 변경(`com.github.librepdf` → `org.openpdf`) 이후 실제 통합 사례 검증 — Phase 5 진입 전 확인

---

## 출처

### Primary (HIGH 신뢰도)
- `@svar-ui/react-gantt` — [SVAR 공식 사이트](https://svar.dev/react/gantt/), [npm](https://www.npmjs.com/package/@svar-ui/react-gantt) — React 19 지원, MIT 라이선스 확인
- `@tanstack/react-table` — [공식 문서](https://tanstack.com/table/v8/docs/guide/expanding) — v8 계층 데이터 공식 지원
- `recharts` — [GitHub](https://github.com/recharts/recharts) — React 19 지원 확인
- PostgreSQL `ltree` — [공식 문서](https://www.postgresql.org/docs/current/ltree.html)
- [Hierarchical models in PostgreSQL — Ackee blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)

### Secondary (MEDIUM 신뢰도)
- [한국SW산업협회 대가산정 가이드 2024 (KISIA)](https://www.kisia.or.kr/) — M/M 계산, 제경비 기준
- [CBD SW개발 표준 산출물 관리 가이드 (CISP)](https://www.cisp.or.kr/) — 단계별 산출물 25개 표준 목록
- `openpdf` — [GitHub](https://github.com/LibrePDF/OpenPDF) — v3.0.3 LGPL/MPL 라이선스 확인 (v3.0.0 패키지명 변경 주의)
- [Gantt chart timezone issue — frappe/gantt GitHub Issues](https://github.com/frappe/gantt/issues/110)
- [Denormalization trade-offs for reporting — Medium](https://rafaelrampineli.medium.com/denormalization-a-solution-for-performance-or-a-long-term-trap-6b9af5b5b831)

### Tertiary (LOW 신뢰도)
- [SW 프로젝트 관리 현장 가이드 (DA블로그)](http://magmajjame.blogspot.com/2015/04/field-project-controll-for-system.html) — 2015년 자료, 보고서 체계 참고 수준
- The Mythical Man-Month (Brooks) — Second System Effect 개념

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
