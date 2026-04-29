# RIS-295 WBS/간트/마일스톤 개선 구현 계획서

## 1. 목표

이번 phase 9의 목적은 현재 분리된 `WBS`, `Gantt`, `Milestone` 기능을 하나의 계획 체계로 묶는 것이다.

- WBS는 작업 패키지와 책임 구조를 유지한다.
- Gantt는 의존성과 마일스톤 도달 흐름을 설명하는 뷰가 된다.
- Milestone은 프로젝트 사건 포인트와 단계 게이트를 표현한다.
- 사용자는 `다음 마일스톤까지 상세 계획`, `이후 구간은 요약 계획` 을 한 프로젝트 안에서 자연스럽게 운영할 수 있어야 한다.

이번 범위는 UI 미화보다 `관계 모델 확정` 이 우선이다.

## 2. 현재 코드 기준 진입점

### 프론트엔드

- [gantt-adapter.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/gantt/gantt-adapter.ts)
  - WBS와 milestone을 `ITask[]` 로 변환한다.
  - 현재 결과는 `tasks` 중심이고 dependency link 모델이 없다.
- [GanttTab.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/gantt/GanttTab.tsx)
  - WBS 기간 drag 수정은 가능하다.
  - milestone 컬러와 zoom preset은 있지만, 선후행/critical path 근거 데이터가 없다.
- [WbsWorkspaceContent.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/WbsWorkspaceContent.tsx)
  - WBS CRUD, reorder, milestone 연결, detail panel 선택 흐름이 있다.
- [MilestonePanel.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/milestone/MilestonePanel.tsx)
  - 현재는 체크포인트 카드 목록에 가깝다.
- [wbs.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/types/wbs.ts)
  - WBS 응답/수정 모델에 dependency 관련 필드가 없다.
- [milestone.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/types/milestone.ts)
  - milestone type/owner/gate 상태가 없다.

### 백엔드

- [WbsItem.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/domain/pm/wbs/entity/WbsItem.java)
  - 현재는 parent, 기간, 진척, 예상 MM, milestone만 가진다.
- [WbsService.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/domain/pm/wbs/service/WbsService.java)
  - CRUD와 reorder는 분리되어 있고 구조 검증도 이미 안정적이다.
- [Milestone.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/domain/pm/milestone/entity/Milestone.java)
  - 이름/목표일/설명/정렬 순서만 가진다.
- [MilestoneService.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/domain/pm/milestone/service/MilestoneService.java)
  - linked WBS count / achievementRate / delayed 계산은 이미 있다.

## 3. 제품 결정

### 3.1 WBS는 dependency source가 아니라 dependency anchor다

- WBS 항목 간 의존성은 WBS 자체 컬럼에 억지로 문자열 입력하지 않는다.
- 별도 dependency 모델을 두고, WBS item은 그 관계의 anchor가 된다.
- 하나의 WBS는 여러 predecessor / successor를 가질 수 있어야 한다.

### 3.2 dependency는 최소한 `FS` 우선으로 시작한다

1차 구현은 `finish-to-start` 를 기본으로 둔다.

- 이유 1: 현재 제품 단계에서 `SS/FF/SF + lag`까지 넣으면 UI/검증 조합이 과도하게 커진다.
- 이유 2: critical path와 timeline 영향 전파를 보여주는 데에는 `FS`만으로도 충분한 가치가 있다.
- 이유 3: 후속 확장을 막지 않기 위해 enum 구조는 열어 두되, UI는 `FS`만 노출한다.

### 3.3 milestone은 사건 포인트 타입을 가진다

1차 타입:

- `deliverable`
- `approval`
- `release`
- `handoff`
- `decision`

이 타입은 표시 뱃지와 필터, 상세 패널 문구, 다음 마일스톤 카드에 공통으로 재사용한다.

### 3.4 rolling-wave는 새 엔진이 아니라 뷰/정책으로 구현한다

- 전체 WBS를 별도 long-term plan 모델로 나누지 않는다.
- 대신 WBS/milestone에 `planning horizon` 을 드러내는 읽기 모델을 추가한다.
- 사용자는 `다음 마일스톤까지 상세`, `이후는 요약` 상태를 필터/강조로 인지한다.

## 4. 데이터 모델 제안

### 4.1 신규 WBS dependency 엔터티

신규 엔터티 초안:

```text
WbsDependency
- id
- project_id
- predecessor_wbs_item_id
- successor_wbs_item_id
- dependency_type
- sort_order
- created_at
- updated_at
```

규칙:

- predecessor와 successor는 같은 project 소속이어야 한다.
- 자기 자신 연결 금지.
- 순환 경로 생성 금지.
- 1차 UI는 `dependency_type = FS` 만 생성하지만 저장소/응답은 enum으로 열어 둔다.

### 4.2 milestone 확장 필드

`Milestone`에 아래 필드를 추가한다.

- `type`
- `owner_user_id` nullable
- `readiness_note` nullable

1차에서는 approval workflow 자체를 넣지 않고, 게이트 성격을 표현하는 메타데이터까지만 넣는다.

### 4.3 읽기 모델 확장

`WbsItem` 응답 확장:

- `predecessorIds`
- `successorIds`
- `isInCurrentWave`
- `blockingMilestoneIds`

`Milestone` 응답 확장:

- `type`
- `ownerUserId`
- `ownerName`
- `readinessNote`
- `inboundDependencyCount`
- `outboundDependencyCount`
- `linkedWbsCompletedCount`
- `nextWaveWbsCount`

## 5. API 계획

### 5.1 WBS dependency CRUD

신규 API:

- `GET /projects/{projectId}/wbs/dependencies`
- `POST /projects/{projectId}/wbs/dependencies`
- `PUT /projects/{projectId}/wbs/dependencies/{dependencyId}`
- `DELETE /projects/{projectId}/wbs/dependencies/{dependencyId}`

이유:

- 기존 `PUT /wbs/{id}` / `PATCH /wbs/reorder` 경계를 깨지 않는다.
- dependency는 구조 변경과 별개 lifecycle을 가진다.

### 5.2 milestone 확장 API

기존 milestone create/update payload에 아래 필드를 추가한다.

- `type`
- `ownerUserId`
- `readinessNote`

현재 이름/목표일/설명 흐름은 유지한다.

### 5.3 Gantt read model

신규 또는 확장 응답:

- gantt tab이 WBS, milestone, dependency를 한 번에 가져갈 수 있는 projection
- 후보 1: 기존 WBS/milestone/dependency 각각 조회 후 FE assemble
- 후보 2: `GET /projects/{projectId}/gantt` projection API

권장안은 후보 1이다.

- 현재 FE query 구조를 크게 흔들지 않는다.
- dependency만 추가 fetch하고 adapter에서 projection하면 된다.
- 이후 성능 문제가 확인되면 projection API로 이관한다.

## 6. 프론트엔드 구현 계획

### 6.1 Phase 9-A. dependency foundation

- `client/src/types/wbs-dependency.ts` 추가
- `client/src/api/wbsDependencyApi.ts` 추가
- query key에 dependency 축 추가
- `gantt-adapter.ts`가 `tasks + links + meta` 를 함께 만들도록 확장
- cycle/self-edge validation error를 사용자 문구로 매핑

완료 기준:

- FE가 dependency 데이터를 읽고 저장할 수 있다.
- gantt chart에 실제 link 데이터가 전달된다.

### 6.2 Phase 9-B. gantt UX 고도화

- 간트 행/바 선택 시 predecessor/successor 하이라이트
- milestone 연결 WBS와 dependency 선 시각 강조
- `다음 마일스톤` 요약 카드
- dependency 없는 task와 있는 task의 구분 legend 추가

완료 기준:

- 사용자가 간트에서 `왜 이 순서인지`, `어떤 milestone으로 수렴하는지` 를 볼 수 있다.

### 6.3 Phase 9-C. WBS 편집 연결

- WBS detail panel에 dependency 섹션 추가
- predecessor/successor 추가/해제 UI
- 현재 wave 여부와 다음 milestone까지 남은 blocking chain 요약

완료 기준:

- 사용자가 WBS 허브 안에서 dependency를 생성/검토할 수 있다.

### 6.4 Phase 9-D. milestone 운영 강화

- milestone form에 type/owner/readiness note 추가
- milestone panel에 type badge, owner, readiness, blocking count 표시
- `milestone only` / `approval only` / `delayed` 필터 추가

완료 기준:

- milestone이 단순 날짜 목록이 아니라 운영 포인트로 보인다.

### 6.5 Phase 9-E. rolling-wave 표면화

- `현재 wave`, `다음 마일스톤`, `후속 후보` 구간 요약 UI 추가
- WBS/Gantt/Milestone 공통 필터 기준 정렬
- empty/help text를 `WBS=구조`, `Gantt=일정/의존성`, `Milestone=게이트` 원칙에 맞게 정리

완료 기준:

- 장기 계획을 전부 상세화하지 않아도 다음 구간 중심 운영이 가능해진다.

## 7. 백엔드 구현 계획

### 7.1 엔터티/레포지토리

- `domain/pm/wbs/entity/WbsDependency.java`
- `domain/pm/wbs/repository/WbsDependencyRepository.java`
- 필요 시 custom query로 project 단위 dependency 조회

### 7.2 서비스

- `WbsDependencyService`
  - create/update/delete/list
  - same-project 검증
  - cycle 검증
  - duplicate edge 차단
- `MilestoneService`
  - type/owner/readiness 저장 및 result 확장

### 7.3 API/DTO

- `WbsDependencyController` 또는 `WbsController` 하위 route 추가
- dependency request/response DTO
- milestone request/response DTO 확장

## 8. 리스크와 완화

### 리스크 1. dependency cycle 검증 복잡도

- 완화: 1차는 project 단위 adjacency map + DFS 검증으로 충분하다.
- reorder와 dependency를 같은 트랜잭션에 억지로 합치지 않는다.

### 리스크 2. 간트 라이브러리 제약

- 완화: 우선 현재 `@svar-ui/react-gantt`가 요구하는 `links` 구조를 확인해서 adapter를 맞춘다.
- link label/custom render가 부족하면 1차는 하이라이트와 side summary 위주로 간다.

### 리스크 3. milestone 확장이 승인 워크플로우로 오해될 수 있음

- 완화: 이번 phase는 `approval state machine` 이 아니라 `게이트 메타데이터` 까지만 범위를 잠근다.

### 리스크 4. rolling-wave 판단 기준 모호성

- 완화: 자동 추론보다 `다음 milestone 기준` 계산으로 제한한다.
- 상세 wave 판정은 milestone targetDate 순과 dependency reachability를 우선 사용한다.

## 9. 구현 순서

1. dependency 엔터티/DTO/API 추가
2. FE dependency 타입/query/adapter 추가
3. gantt link 시각화 연결
4. WBS detail dependency 편집 UI
5. milestone type/owner/readiness 확장
6. rolling-wave 요약/필터 추가
7. 통합 QA

## 10. child issue 분할 제안

승인 후 바로 아래 child issue로 쪼갠다.

1. `RIS-295A` dependency 도메인/API
2. `RIS-295B` Gantt dependency 시각화
3. `RIS-295C` WBS detail dependency 편집
4. `RIS-295D` milestone 게이트 확장
5. `RIS-295E` rolling-wave UX + copy 정리
6. `RIS-295Q` 통합 QA

## 11. 이번 계획에서 의도적으로 제외한 것

- CPM/PERT 수준의 고급 일정 계산
- 다중 dependency 타입 전체 UI 노출
- milestone 승인 프로세스 자동화
- 팀 캘린더/리소스 leveling
- TODO 보드와 dependency 자동 상호동기화

## 12. 승인 요청 포인트

아래 3가지만 승인되면 구현 child issue를 열 수 있다.

1. dependency를 별도 엔터티로 둔다.
2. 1차 dependency UI는 `FS` 만 노출한다.
3. milestone 확장은 `게이트 메타데이터` 까지만 포함한다.
