# Pitfalls Research

**Domain:** SI 프로젝트 관리 플랫폼 (WBS / 마일스톤 / 인력·비용 / 간트차트 / 보고서)
**Researched:** 2026-04-02
**Confidence:** MEDIUM — 도메인별 공식 사례 + 커뮤니티 패턴 기반. 1인 개발 SI 툴 전용 사례 직접 출처 부족.

---

## Critical Pitfalls

### Pitfall 1: WBS 계층 구조에 adjacency list(parent_id) 단순 적용

**What goes wrong:**
`parent_id` 자기참조 컬럼만으로 WBS를 구현하면 서브트리 전체 조회(하위 작업 합산, 진척률 롤업, 간트 렌더링용 정렬)에 재귀 CTE가 필수가 된다. 깊이 3~5 수준부터 쿼리 복잡도가 선형 증가하고, "전체 WBS를 한 번에 불러올 때" N+1이 발생하거나 재귀 깊이 제한(PostgreSQL 기본 100)에 걸린다.

**Why it happens:**
초기에 Excel 스타일 트리를 빠르게 모델링하려다 단순 FK 관계만 쓰게 된다. 처음 몇 depth에서는 문제가 없어 보여 이후 리팩터링 시점을 놓친다.

**How to avoid:**
- 읽기 빈도가 쓰기보다 압도적으로 높은 WBS 특성상 **materialized path(ltree)** 또는 **closure table** 패턴을 초기부터 선택한다.
- PostgreSQL `ltree` 확장: path 컬럼에 `1.2.5` 형태로 저장, 서브트리 쿼리가 `path <@ '1.2'` 단일 인덱스 스캔으로 해결된다.
- 이동/재정렬이 잦다면 closure table(별도 ancestor-descendant 테이블)이 ltree보다 안전하지만 쓰기 비용이 크다.
- 1인 프로젝트·SI 규모(WBS 수백 행 수준)에서는 ltree가 최적. 재귀 CTE는 최후 수단.

**Warning signs:**
- WBS 페이지 로딩 시 SQL 로그에서 재귀 CTE가 보이거나, 쿼리 수가 트리 depth에 비례해 늘어날 때
- 진척률 롤업 계산을 Java 코드에서 루프로 처리하고 있을 때

**Phase to address:**
WBS 기능 구현 첫 번째 단계 — 엔티티 설계 시점에 반드시 결정

---

### Pitfall 2: 날짜/기간 계산을 프론트엔드 로컬 타임에 의존

**What goes wrong:**
간트 차트 바(bar) 위치를 `new Date()` 기준 픽셀 계산으로 구현하면, 브라우저 타임존이나 서머타임 전환 시점에 하루 오차가 발생한다. "오늘" 강조선이 UTC 기준으로 렌더링되거나, 한국 사용자가 밤 9시 이후에 접속하면 날짜 경계가 어긋난다.

**Why it happens:**
JS `Date` 객체는 기본적으로 로컬 타임이지만, REST API 응답은 UTC ISO-8601이다. 변환 없이 바로 차트 라이브러리에 넘기면 라이브러리 내부에서 UTC로 해석한다. 특히 daylight saving time 경계에서 시간이 1시간 뒤틀려 간트 바가 하루 잘못 표시된다.

**How to avoid:**
- 모든 날짜 값은 `date-fns` 또는 `dayjs`를 통해 명시적으로 파싱·포맷한다. 날짜 전용 필드(시작일, 종료일)는 **날짜만 저장하는 문자열(`YYYY-MM-DD`)** 을 백엔드에서 내려주고, 프론트는 타임존 변환 없이 그대로 비교한다.
- 간트 차트 라이브러리를 직접 구현할 경우, 날짜→픽셀 변환은 `date-fns/differenceInCalendarDays` 기반으로 타임존-독립적으로 구현한다.
- 백엔드 WBS 날짜 컬럼은 `DATE` 타입(timestamptz 아님) 사용 — 불필요한 시각 정보를 제거.

**Warning signs:**
- 간트 바가 1일 앞뒤로 밀려 보이는 UI 버그
- "오늘" 마커가 자정 전후로 날짜가 달라지는 현상
- 테스트를 UTC 환경에서만 실행하고 KST(+09:00) 환경에서 검증 안 할 때

**Phase to address:**
간트 차트 UI 구현 단계 — 날짜 유틸리티 레이어를 별도 모듈로 먼저 구성

---

### Pitfall 3: 진척률/비용 집계를 온디맨드 재계산에만 의존

**What goes wrong:**
WBS 진척률, 인력 M/M 합계, 예산 소진율 등을 모든 조회 시점마다 집계 쿼리로 계산하면, WBS 항목이 100개를 넘으면 보고서 페이지 로딩이 눈에 띄게 느려진다. 특히 간트+진척률+비용을 한 화면에 합쳐 보여주는 대시보드에서 대형 JOIN이 중첩된다.

**Why it happens:**
초기 데이터가 적을 때는 집계가 빠르므로 "나중에 최적화"로 미루게 된다. 이미 API 구조가 고정되면 캐싱 레이어를 끼워 넣기 어렵다.

**How to avoid:**
- WBS 작업 수정 시 **롤업 트리거** 방식: 상위 노드의 `progress_snapshot`, `actual_mm_snapshot` 컬럼을 업데이트한다(쓰기 시점 집계).
- 보고서용 수치(월간 비용, 누적 M/M)는 별도 `report_snapshot` 테이블에 주기 저장(스케줄 또는 보고서 생성 버튼 트리거).
- 단, 1인 프로젝트 초기(데이터 수십 행)에서는 온디맨드 쿼리로 시작하고, 페이지 로딩 200ms 초과 시점에 스냅샷 컬럼 도입을 시작하는 점진적 접근이 현실적이다.

**Warning signs:**
- 보고서 API 응답에 200ms 이상 소요
- 쿼리 로그에 WBS 전체 테이블 스캔 + SUM/GROUP BY가 매 요청마다 등장

**Phase to address:**
보고서 기능 구현 단계 — 스냅샷 컬럼 여부를 데이터 모델 설계 시 미리 결정

---

### Pitfall 4: 기능 범위 과팽창 — "MS Project를 재개발"하려는 충동

**What goes wrong:**
SI 현장에서 필요한 것들을 나열하다 보면 자연스럽게 크리티컬 패스 계산, 자원 평탄화(resource leveling), EARNED VALUE 분석, RACI 매트릭스 등 엔터프라이즈 PM 기능을 전부 넣으려는 충동이 생긴다. 1인 개발 환경에서 이 중 하나라도 구현하면 다른 핵심 기능이 밀려 결국 MVP가 출시되지 못한다.

**Why it happens:**
개발자가 사용자이기도 한 1인 프로젝트 특성상 "언젠가 필요할 것 같은 기능"을 설계 단계에서 과하게 반영하게 된다(Second System Effect). SI 현장 경험이 많을수록 "현장에서 불편했던 모든 것"을 해결하려는 욕구가 커진다.

**How to avoid:**
- 각 단계의 기능 정의에 **"반드시 있어야 하는 것" vs "있으면 좋은 것"** 을 명시적으로 구분한다.
- 크리티컬 패스 계산, 자원 평탄화, EVM은 Out of Scope로 명시하고, 향후 단계에서 재검토한다.
- 간트 차트는 **시각화만** 먼저 구현(읽기 전용). 드래그로 날짜 변경하는 편집 기능은 별도 단계로 분리.
- 보고서는 수동 입력 + 반자동 집계부터 시작. 완전 자동 생성은 데이터가 쌓인 후.

**Warning signs:**
- 단일 단계 작업 목록이 20개를 넘을 때
- 엔티티 설계에 `resource_leveling_config`, `earned_value_*` 같은 컬럼이 등장할 때
- 간트 구현을 시작도 못하고 "의존성 그래프 엔진"을 먼저 설계하고 있을 때

**Phase to address:**
모든 PM 기능 단계 진입 시 — 스코프 정의 체크리스트 운영

---

### Pitfall 5: 간트 차트를 직접 Canvas로 구현하려는 시도

**What goes wrong:**
기존 라이브러리가 "딱 맞지 않는다"는 이유로 간트 차트를 React + Canvas/SVG로 처음부터 구현하면, 줌/스크롤/리사이즈/드래그 인터랙션을 모두 직접 구현해야 한다. 이 작업만으로 2~4주가 소모되고, 브라우저 다크모드·Electron 호환·접근성 등 부가 요건까지 합치면 개발 기간이 폭발한다.

**Why it happens:**
ERD 캔버스(React Flow)를 직접 다루는 경험이 있어 "간트도 비슷하게 만들 수 있겠다"는 자신감이 생긴다. 기존 라이브러리의 스타일 커스터마이징 제약을 보고 직접 구현을 선택한다.

**How to avoid:**
- `frappe-gantt`(MIT, SVG 기반, 경량), `@dhx/gantt`(상용이지만 기능 완성도), `react-gantt-task`(React 전용) 중 하나를 평가 후 선택한다.
- Headless 방식 선호: 렌더링은 라이브러리, 데이터 레이어는 직접 구현.
- 어떤 라이브러리도 맞지 않는다면 "읽기 전용 SVG 간트"만 먼저 구현하고, 인터랙션은 다음 단계로 위임한다.
- 라이브러리 선택 기준: (1) 한국어/타임존 지원, (2) Tailwind/CSS Variable 테마 호환, (3) Electron webview 동작 확인.

**Warning signs:**
- "간트 렌더링 엔진"이라는 단어가 설계 문서에 등장할 때
- `requestAnimationFrame` 기반 스크롤 최적화를 직접 구현하고 있을 때

**Phase to address:**
간트 차트 구현 단계 진입 전 — 라이브러리 탐색을 별도 스파이크로 진행

---

### Pitfall 6: 인력 투입(M/M) 모델을 과하게 정규화

**What goes wrong:**
인력 투입을 `user_id × role_id × project_phase_id × planned_mm × actual_mm × unit_cost` 형태의 완전 정규화 스키마로 시작하면, 실제 입력 UI가 지나치게 복잡해진다. SI 현장에서는 "이번 달 A씨 0.5M/M 투입" 수준의 간단한 입력이 필요한데, 지나친 정규화로 입력 폼이 5~6 depth 드릴다운이 된다.

**Why it happens:**
데이터 모델러 본능상 모든 차원을 분리하려는 욕구가 생긴다. "나중에 다차원 분석을 위해"라는 명목으로 과설계한다.

**How to avoid:**
- MVP에서는 `(team_member_id, year_month, planned_mm, actual_mm, unit_cost)` 수준의 플랫 테이블로 시작한다.
- 역할별 집계가 필요하면 `team_member.role` 조인으로 충분하다.
- 단가 이력이 필요하면 `unit_cost_history` 테이블을 나중에 추가한다(처음부터 이력 테이블 설계 불필요).

**Warning signs:**
- 인력 투입 엔티티가 5개 이상의 외래 키를 가질 때
- 투입 등록 UI 목업에서 사용자가 3단계 이상 선택해야 할 때

**Phase to address:**
인력·비용 관리 구현 단계 초기 설계

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| WBS에 `parent_id` 단순 FK 사용 | 빠른 엔티티 구현 | 서브트리 쿼리 재귀 CTE 의존, 성능 저하 | WBS depth가 2단계 이하일 때만 |
| 간트 날짜를 `timestamp` 저장 | 기존 엔티티 패턴 재사용 | 타임존 버그, 날짜 경계 오차 | Never — 날짜 전용 필드는 `DATE` 타입 |
| 진척률 집계를 온디맨드 재계산 | 초기 구현 단순화 | 보고서 페이지 성능 저하 | 초기 MVP (항목 < 50개) 한정 |
| 보고서 자동생성부터 구현 | 완성도 높은 기능 | 집계 로직이 UI보다 복잡해져 배포 지연 | Never — 수동 입력 + 반자동부터 시작 |
| 간트 차트 직접 Canvas 구현 | 완전한 커스터마이징 | 2~4주 추가 소요, ERD와 유지보수 충돌 | Never — 기존 라이브러리 우선 평가 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Yjs CRDT + WBS 트리 | WBS 노드를 `Y.Array`로 직렬화 시 부모-자식 재배열 시 인덱스 충돌 | 노드를 `Y.Map`(nodeId → node 데이터), 자식 목록을 별도 `Y.Array`(nodeId 목록만)로 분리 |
| 간트 라이브러리 + React Query | 라이브러리가 내부 state를 직접 변경해 React Query 캐시와 불일치 | 간트 라이브러리는 읽기 전용 뷰어로만 사용, 편집은 React 폼 → mutation 경로로만 |
| Electron + 날짜 처리 | Electron은 시스템 타임존을 따르므로 웹 환경과 날짜 결과가 달라질 수 있음 | 날짜 비교/계산 로직은 반드시 `date-fns`의 타임존-독립 함수만 사용 |
| 보고서 PDF 내보내기 | `html2canvas` + `jsPDF` 조합이 간트 SVG를 제대로 캡처 못하는 경우 많음 | 서버사이드 PDF 생성(JasperReports, Apache FOP) 또는 인쇄 CSS(@page) 우선 검토 |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| WBS 전체 트리를 단일 요청으로 fetch | 첫 로딩 지연, 큰 JSON 응답 | 루트 노드 + 1단계 자식만 fetch, 펼침 시 lazy load | WBS 항목 200개 초과 |
| 진척률 롤업을 렌더링 중 재귀 계산 | 간트 차트 스크롤 시 프레임 드롭 | 롤업 값을 DB 컬럼에 사전 저장, 렌더링은 읽기만 | 트리 depth 4 이상, 항목 100개 초과 |
| 월간 보고서 집계를 요청마다 풀 스캔 | 보고서 API 응답 500ms 이상 | `report_snapshot` 테이블 + 월별 배치 갱신 | 팀 멤버 10명 × 12개월 × 항목 100개 |
| 간트 전체를 단일 SVG로 렌더링 | 항목 증가 시 DOM 노드 폭증, 스크롤 버벅임 | 뷰포트 기반 가상화(virtual rendering) 지원 라이브러리 선택 | 간트 항목 500개 초과 |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| WBS 작업의 팀 소속 검증 누락 | 다른 팀의 WBS 노드를 직접 수정 가능 | 모든 WBS/마일스톤 API에서 `teamId` 소속 검증 레이어 추가 (기존 팀 체계 활용) |
| 비용/단가 데이터에 역할 기반 접근제어 미적용 | VIEWER 권한자가 인건비·계약금액 열람 가능 | 비용 관련 API에 ADMIN/MEMBER 이상 권한 체크 추가 (기존 TeamMember.role 활용) |
| 보고서 자동집계 API의 팀 경계 검증 부재 | teamId 파라미터 변조로 타팀 보고서 접근 | 모든 집계 쿼리에 팀 ID 필터를 QueryDSL 수준에서 강제 적용 |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| WBS 트리 전체 펼침 기본 상태 | 항목이 많으면 첫 화면이 압도적, 스크롤 무한 | 1단계만 펼쳐진 상태로 초기화, 펼침 상태를 localStorage에 저장 |
| 간트 차트에 모든 WBS 항목 표시 | 수백 개 항목이 한 화면에 표시되어 식별 불가 | 기본값은 마일스톤/1단계 요약 항목만 표시, 하위 항목 토글 가능 |
| 진척률 입력을 퍼센트 슬라이더만으로 | 정확한 수치 입력 불편 | 슬라이더 + 숫자 직접 입력 필드 병행 |
| 보고서를 완전 자동생성에서 바로 발송 | 집계 오류가 외부로 공유되는 리스크 | 자동집계 → 사용자 검토 → 수동 확정 → 내보내기 플로우 강제 |
| 인력 투입 입력 UI가 스프레드시트 없음 | SI 현장에서는 엑셀 입력 패턴이 몸에 배어 있어 폼 UI 거부감 | 행 기반 인라인 편집(테이블 셀 직접 클릭) 패턴 우선 구현 |

---

## "Looks Done But Isn't" Checklist

- [ ] **WBS 진척률 롤업:** 하위 노드 변경 시 모든 상위 노드의 진척률이 자동 갱신되는지 확인 — 수동 업데이트 시 정합성 깨짐
- [ ] **마일스톤 완료 판정:** 연결된 WBS 항목이 전부 100%일 때만 완료 처리되는지 검증 — 독립 상태 변경 허용 시 데이터 불일치
- [ ] **간트 날짜 경계:** KST(+09:00) 환경에서 "오늘" 마커와 작업 바 위치가 정확한지 Electron 내에서 별도 검증
- [ ] **보고서 집계 시점 명시:** 보고서 화면에 "집계 기준일시"가 표시되는지 확인 — 실시간 vs 스냅샷 혼동 방지
- [ ] **팀 멤버 탈퇴 후 데이터 처리:** 탈퇴한 멤버가 담당자로 지정된 WBS 항목이 화면에서 깨지지 않는지 확인
- [ ] **비용 항목 삭제 시 집계:** 비용 레코드 삭제 후 보고서 합계가 즉시 반영되는지 또는 스냅샷 기준인지 명확히 정의
- [ ] **Electron 오프라인 모드:** 로컬에서 WBS 편집 후 온라인 복귀 시 Yjs 동기화 충돌 처리가 있는지 확인

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WBS에 adjacency list만 구현 후 성능 문제 | HIGH | `ltree` 컬럼 추가 마이그레이션 + 기존 데이터 path 재산출 배치 + API 쿼리 교체. 다운타임 최소화 위해 `ltree` 컬럼을 먼저 추가(nullable)하고 백그라운드 채움 후 전환 |
| 간트 날짜 타임존 버그 발견 | MEDIUM | 백엔드 날짜 컬럼을 `DATE`로 마이그레이션, 프론트 파싱 레이어 교체. 기존 `timestamp` 데이터는 UTC 자정 기준으로 `DATE`로 변환 |
| 직접 구현 간트가 성능/유지보수 한계 도달 | HIGH | 상용 라이브러리로 교체 + 데이터 레이어(React Query + 간트 DTO)가 분리되어 있으면 뷰 레이어만 교체 가능. 뷰와 데이터가 결합되어 있으면 전면 재구현 필요 |
| 보고서 집계 쿼리 성능 저하 | MEDIUM | `report_snapshot` 테이블 추가 + 마이그레이션으로 과거 집계값 채움 + API를 스냅샷 읽기로 전환. 기존 API 계약 변경 불필요 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WBS 계층 구조 DB 모델 선택 | WBS 기능 설계·구현 단계 | `ltree` 또는 closure table 패턴 적용 확인, 재귀 CTE 없이 서브트리 조회 동작 |
| 날짜/타임존 버그 | 간트 차트 구현 단계 | KST 환경에서 간트 바 위치와 오늘 마커 정확성 수동 검증 |
| 집계 성능 트랩 | 보고서 기능 구현 단계 | 보고서 API 응답 시간 200ms 이하 기준으로 성능 테스트 |
| 기능 범위 과팽창 | 각 PM 기능 단계 진입 시 | 단계별 스코프 문서에 "Out of Scope" 항목 명시 확인 |
| 간트 직접 구현 시도 | 간트 차트 기능 계획 단계 | 라이브러리 스파이크 결과(POC) 문서화 선행 |
| 인력 투입 모델 과설계 | 인력·비용 관리 구현 단계 | 투입 등록 폼이 3단계 이하 인터랙션으로 완성 가능한지 UI 검토 |
| 권한 검증 누락 | 모든 PM API 구현 단계 | 팀 소속 검증 + 역할 기반 접근제어 통합 테스트 |

---

## Sources

- [Hierarchical models in PostgreSQL — Ackee blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
- [The Closure Table Pattern for Hierarchical Filters — Medium](https://balevdev.medium.com/the-closure-table-pattern-for-hierarchical-filters-with-sql-31644e760c09)
- [Mastering SQL Trees: Adjacency Lists to Nested Sets and Closure Tables — TeddySmith.IO](https://teddysmith.io/sql-trees/)
- [Gantt chart timezone issue (daylight savings) — frappe/gantt GitHub Issues](https://github.com/frappe/gantt/issues/110)
- [Top 6 JavaScript Gantt & Task Scheduling Libraries in 2026 — DEV Community](https://dev.to/lenormor/top-6-javascript-gantt-task-scheduling-libraries-in-2026-30mj)
- [WBS for Software Development — Medium](https://medium.com/@noah_henriksen/wbs-for-software-development-8ba193b089b8)
- [Work Breakdown Structure pitfalls — Wrike](https://www.wrike.com/project-management-guide/faq/what-is-work-breakdown-structure-in-project-management/)
- [Denormalization trade-offs for reporting — Medium (Rafael Rampineli)](https://rafaelrampineli.medium.com/denormalization-a-solution-for-performance-or-a-long-term-trap-6b9af5b5b831)
- [Software project management anti-patterns — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0164121209002325)
- [Scope Creep prevention — Asana](https://asana.com/resources/what-is-scope-creep)
- The Mythical Man-Month (Brooks) — Second System Effect 참고

---
*Pitfalls research for: SI 프로젝트 관리 플랫폼 (WBS / 간트 / 인력·비용 / 보고서)*
*Researched: 2026-04-02*
