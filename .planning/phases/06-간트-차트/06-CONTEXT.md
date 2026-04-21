# Phase 6 Context: 간트 차트

## Domain Boundary

WBS 데이터를 기반으로 간트 차트를 자동 렌더링하고, 타임라인 단위 조절과 바 드래그로 기간을 변경하며, 마일스톤이 다이아몬드 마커로 표시되는 시각화 기능을 구현한다.

**신규 기능 추가 없음** — Phase 5에서 구현된 WBS/마일스톤 데이터의 시각화 레이어만 추가.

## Requirements

- **GANTT-01**: WBS에 기간이 설정된 항목이 간트 차트에 자동으로 렌더링된다
- **GANTT-02**: 사용자가 일/주/월 단위로 타임라인 줌을 전환할 수 있다
- **GANTT-03**: 사용자가 간트 바를 드래그하여 WBS 항목의 시작일/종료일을 변경할 수 있다
- **GANTT-04**: 마일스톤이 간트 차트에 다이아몬드 마커로 표시되고 목표일 지연 여부가 색으로 구분된다

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 6 정의, 의존성, 성공 기준
- `.planning/REQUIREMENTS.md` — GANTT-01~04 요구사항
- `.planning/phases/05-wbs-milestone/05-SUMMARY.md` — Phase 5 WBS/마일스톤 구현 결과
- `src/main/java/com/smarterd/domain/pm/wbs/entity/WbsItem.java` — WBS 엔티티 (startDate, endDate, progressRate)
- `src/main/java/com/smarterd/domain/pm/milestone/entity/Milestone.java` — 마일스톤 엔티티 (targetDate, achievementRate, isDelayed)
- `src/main/java/com/smarterd/api/project/WbsController.java` — WBS API 엔드포인트
- `src/main/java/com/smarterd/api/project/MilestoneController.java` — 마일스톤 API 엔드포인트
- `client/src/pages/diagram/DiagramsPage.tsx` — 프로젝트 허브 탭 구조 (documents/overview/wbs)
- `client/src/components/wbs/WbsTab.tsx` — 현재 WBS 탭 (기존 CRUD 기준면)
- `client/src/components/wbs/wbs-tree-utils.ts` — WBS 트리 유틸리티 (간트에서 재사용)
- `client/src/api/wbsApi.ts` — WBS API 함수 (update 재사용)
- `client/src/api/milestoneApi.ts` — 마일스톤 API 함수
- `client/src/types/wbs.ts` — WbsItem 타입 정의
- `client/src/types/milestone.ts` — Milestone 타입 정의

## Prior Decisions (이전 Phase에서 결정됨)

- **라이브러리**: `@svar-ui/react-gantt` MIT 라이브러리 사용 (직접 Canvas 구현 금지) — STATE.md
- **날짜 타입**: WBS DATE 타입 사용 — 간트 타임존 버그 방지
- **탭 구조**: DiagramsPage에 documents/overview/wbs 탭 존재 — Phase 4/5
- **WBS 트리**: depth 0~2, parentId, sortOrder — Phase 5
- **마일스톤 지연 판단**: `targetDate < today && achievementRate < 100` — Phase 5
- **권한**: ProjectContextLoader 공통 인증/권한 검증 — Phase 5
- **테마**: CSS Variable 기반 디자인 토큰 — `@svar-ui/react-gantt` + Tailwind 호환성 POC 필요

## Decisions

### 1. 간트 차트 배치/레이아웃
**결정: 기존 `wbs` 탭은 유지하고, 별도 `gantt` 탭에서 SVAR 기본 `grid + chart` 레이아웃 사용**
- `DiagramsPage`에 `gantt` 탭을 추가하고, 기존 `wbs` 탭의 CRUD 화면은 유지
- 간트 화면의 좌측은 SVAR built-in grid, 우측은 chart로 구성
- `columns={false}`로 grid를 숨기고 기존 WBS 테이블과 chart를 커스텀 동기화하는 방식은 채택하지 않음
- milestone panel은 1차 구현에서 고정 3열로 붙이지 않고, 하단 섹션 또는 선택 항목 상세 패널로 분리
- Gantt 탭에서만 폭 제한을 완화해 grid/chart 리사이저와 compact mode를 자연스럽게 활용
- **Why**: 기존 WBS의 reorder/depth/inline edit 상태를 별도 split view로 양방향 동기화하는 비용이 크고, SVAR가 제공하는 grid/chart/resizer/compact mode를 그대로 쓰는 편이 구현 리스크가 낮음

### 2. 타임라인 줌 UI
**결정: 버튼 그룹 `[일 | 주 | 월]` + '오늘' 버튼**
- 간트 상단 툴바에 `[일] [주] [월]` 버튼 3개 배치
- 현재 활성 단위가 시각적으로 구분됨 (active state)
- '오늘' 버튼으로 현재 날짜 위치로 즉시 이동
- 한 눈에 현재 단위가 보이고 클릭 한 번으로 전환
- 구현은 SVAR built-in Toolbar를 그대로 노출하기보다, 앱 헤더/툴바 스타일에 맞춘 커스텀 버튼 그룹에서 `api.exec("zoom-scale", ...)` 또는 preset zoom level 전환으로 처리

### 3. 타임라인 헤더 표시
**결정: 2줄 헤더 (상단: 큰 단위, 하단: 세부 단위)**
- 일 모드: 상단 "4월" → 하단 "14 | 15 | 16 | ..."
- 주 모드: 상단 "2026" → 하단 "W15 | W16 | W17 | ..."
- 월 모드: 상단 "2026" → 하단 "1월 | 2월 | 3월 | ..."
- MS Project 스타일의 계층적 날짜 표시
- SVAR의 `scales` 배열을 2개 row로 구성해 네이티브하게 표현

### 4. 바 드래그 스냅
**결정: 1일 단위 스냅**
- 드래그 시 항상 1일 단위로 정렬
- SI 현장에서 WBS 기간은 일 단위로 관리하므로 가장 자연스러움
- 줌 모드와 무관하게 일관된 스냅 동작

### 5. 날짜 변경 저장 시점
**결정: 드래그 종료 즉시 자동 저장**
- 마우스를 놓는 순간 API 호출하여 서버 반영
- 별도 저장 버튼 없이 직관적으로 동작
- 기존 WBS updateWbsItem API 재사용 (startDate, endDate 필드)
- 드래그 중에는 tooltip으로 변경될 날짜 미리보기 표시

### 6. 마일스톤 지연 표시
**결정: 색상 구분 (정상: 초록 다이아몬드, 지연: 빨강 다이아몬드)**
- 정상 상태: 초록색 다이아몬드 마커
- 지연 상태: 빨간색 다이아몬드 마커
- 단순 명확하고 한눈에 파악 가능
- GANTT-04 요구사항과 정확히 일치
- 색상은 디자인 토큰 시스템 사용 (하드코딩 금지)

### 7. 진척률 시각화
**결정: 바 내부 채움 (진한 색 비율로 표현)**
- 간트 바 안에 progressRate만큼 진한 색으로 채움
- 예: 60% 완료 → 바의 60%가 진하게 채워지고 나머지는 연함
- 가장 직관적이고 공간 효율적인 방식
- 정확한 수치는 마우스 호버 tooltip에서 확인

## Claude's Discretion

다음 항목은 researcher/planner가 구현 시 자유롭게 결정:
- Gantt 탭의 실제 컨테이너 폭과 패딩 정책
- 간트 바 색상 (depth별 또는 상태별 — 디자인 토큰 범위 내)
- tooltip 세부 표시 항목 (날짜, 담당자, 진척률 등)
- milestone 상세를 하단 섹션으로 둘지, 선택 항목 상세 패널로 둘지
- `@svar-ui/react-gantt` 커스터마이징 범위 (API가 지원하는 범위 내)
- 반응형 처리 (좁은 폭에서 SVAR compact mode와 앱 레이아웃을 어떻게 맞출지)

## Specifics

- MS Project 스타일을 참조 모델로 삼되, 배치는 별도 Gantt 탭 + 2줄 헤더 + 다이아몬드 마커 조합으로 해석
- SI 현장 사용자가 주 사용자 — 익숙한 패턴 우선
- `@svar-ui/react-gantt` + Tailwind CSS Variable 테마 호환성 POC가 연구 단계에서 반드시 확인돼야 함
- zoom/scales는 SVAR 공식 문서 기준으로 native 지원 범위 내에서 설계

## Deferred Ideas

없음

## Open Risks

- 프로젝트 허브의 현재 `max-w-5xl` 폭 제한이 Gantt 탭에서도 유지되면 grid/chart 가시성이 부족할 수 있음
- 커스텀 버튼 그룹과 SVAR zoom level/state 동기화 방식 (`api.getState().zoom`) 정리가 필요
- 대규모 WBS (100+ 항목) 렌더링 성능
- Tailwind CSS Variable 테마 호환성 — 라이브러리 자체 스타일과 충돌 가능성
