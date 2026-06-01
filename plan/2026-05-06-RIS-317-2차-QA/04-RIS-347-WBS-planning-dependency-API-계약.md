# RIS-347 WBS planning/dependency API 계약 정리

- 작성일: 2026-05-06
- 대상 이슈: RIS-347
- 상위 이슈: RIS-317
- 목적: FE가 현재 로컬 구현을 서버 API로 치환할 때 필요한 WBS planning/dependency 계약을 백엔드 실제 구현 기준으로 고정한다.

## 범위

- subtree duplicate
- template save/list/instantiate
- bulk create
- dependency shift preview/apply

## 엔드포인트 요약

| 기능 | Method / Path | 성공 코드 | 비고 |
| --- | --- | --- | --- |
| subtree 복제 | `POST /api/teams/{teamId}/projects/{projectId}/wbs/{wbsItemId}/duplicate-subtree` | `201 Created` | subtree 내부 dependency 복제 옵션 지원 |
| template 목록 | `GET /api/teams/{teamId}/projects/{projectId}/wbs/templates` | `200 OK` | 최신 수정 순 정렬 |
| template 저장 | `POST /api/teams/{teamId}/projects/{projectId}/wbs/templates` | `201 Created` | subtree snapshot 저장 |
| template 적용 | `POST /api/teams/{teamId}/projects/{projectId}/wbs/templates/{templateId}/instantiate` | `201 Created` | subtree + dependency 생성 |
| bulk create | `POST /api/teams/{teamId}/projects/{projectId}/wbs/bulk-create` | `201 Created` | `clientKey` 기반 부모 연결 |
| dependency shift preview | `POST /api/teams/{teamId}/projects/{projectId}/wbs/dependency-shift-preview` | `200 OK` | DB 반영 없음 |
| dependency shift apply | `POST /api/teams/{teamId}/projects/{projectId}/wbs/dependency-shift-apply` | `200 OK` | 검증 이슈가 없을 때만 DB 반영 |

## 계약 상세

### 1. Subtree duplicate

요청 body:

```json
{
  "parentId": 200,
  "resetAssignee": true,
  "resetSchedule": false,
  "resetProgress": true,
  "resetMilestone": true,
  "includeDependencies": true
}
```

응답 body:

```json
{
  "rootItemId": 301,
  "items": [
    {
      "id": 301,
      "parentId": 200,
      "name": "운영 wave",
      "depth": 1
    }
  ],
  "dependencies": [
    {
      "id": 701,
      "predecessorWbsItemId": 301,
      "successorWbsItemId": 302,
      "dependencyType": "FS"
    }
  ]
}
```

규칙:

- `includeDependencies=true`일 때 source subtree 내부 dependency만 함께 복제된다.
- `resetSchedule=true`면 `startDate/endDate`는 `null`로 초기화된다.
- `resetProgress=true`면 `progressRate=0`으로 초기화된다.
- `resetMilestone=true`면 `milestoneId` 연결이 제거된다.
- `rootItemId`는 생성된 subtree 루트의 새 ID다.

### 2. Template save/list/instantiate

`POST /templates` 요청:

```json
{
  "sourceWbsItemId": 101,
  "name": "기본 운영 wave",
  "description": "반복 사용하는 운영형 작업 골격"
}
```

`POST /templates` 응답:

```json
{
  "id": 11,
  "name": "기본 운영 wave",
  "description": "반복 사용하는 운영형 작업 골격",
  "rootName": "운영 wave",
  "itemCount": 5,
  "dependencyCount": 3
}
```

`GET /templates` 응답 항목:

- `id`
- `name`
- `description`
- `rootName`
- `itemCount`
- `dependencyCount`
- `createdAt`
- `updatedAt`

`POST /templates/{templateId}/instantiate` 요청:

```json
{
  "parentId": 200,
  "resetAssignee": true,
  "resetSchedule": true,
  "resetProgress": true,
  "resetMilestone": true,
  "includeDependencies": true
}
```

`instantiate` 응답은 duplicate와 동일한 `WbsSubtreeMutationResponse`다.

규칙:

- template payload는 subtree snapshot 기반이므로, 저장 시점의 item/dependency 구조가 그대로 보존된다.
- `includeDependencies=false`면 item만 생성되고 `dependencies`는 빈 배열이 된다.
- template 적용/복제 응답에는 생성된 item 전체와 dependency 전체가 포함되므로 FE는 별도 refetch 없이 optimistic merge가 가능하다.

### 3. Bulk create

요청 body:

```json
{
  "items": [
    {
      "clientKey": "phase-analysis",
      "name": "분석",
      "parentId": 100
    },
    {
      "clientKey": "task-api-design",
      "parentClientKey": "phase-analysis",
      "name": "API 설계"
    }
  ]
}
```

응답 body:

```json
{
  "items": [
    {
      "clientKey": "phase-analysis",
      "item": {
        "id": 301,
        "name": "분석"
      }
    },
    {
      "clientKey": "task-api-design",
      "item": {
        "id": 302,
        "parentId": 301,
        "name": "API 설계"
      }
    }
  ]
}
```

규칙:

- FE는 생성 결과를 `clientKey -> created item.id`로 역매핑해야 한다.
- 같은 요청 안에서 부모를 참조할 때는 `parentClientKey`를 사용한다.
- `parentId`는 기존 DB row를 부모로 삼을 때만 사용한다.
- `clientKey` 중복, 자기 자신을 가리키는 `parentClientKey`, 해소 불가능한 parent cycle은 모두 `error.business.wbs-reorder-invalid`로 실패한다.
- 서비스는 입력 순서를 그대로 보장하지 않고, 부모가 해소되는 순서로 생성한다. FE는 응답 배열 순서보다 `clientKey` 매핑을 기준으로 후처리해야 한다.

### 4. Dependency shift preview/apply

요청 body:

```json
{
  "anchors": [
    {
      "wbsItemId": 101,
      "startDate": "2026-05-12",
      "endDate": "2026-05-16"
    }
  ]
}
```

응답 body:

```json
{
  "graphValid": true,
  "applied": false,
  "updates": [
    {
      "wbsItemId": 101,
      "originalStartDate": "2026-05-10",
      "originalEndDate": "2026-05-14",
      "startDate": "2026-05-12",
      "endDate": "2026-05-16",
      "anchor": true
    }
  ],
  "issues": []
}
```

규칙:

- `preview`는 계산만 하고 `applied=false`다.
- `apply`는 `issues=[]`이고 `graphValid=true`일 때만 실제 일정이 저장되며, 그때만 `applied=true`다.
- `updates`에는 직접 이동한 anchor와 downstream으로 밀린 항목이 함께 들어간다.
- `anchor=true`는 사용자가 직접 이동한 row, `anchor=false`는 dependency 전파로 이동한 row다.
- 일정이 비어 있는 predecessor/successor가 있으면 `issues`에 `missing-date`가 쌓이고, apply는 저장하지 않는다.
- canonical shift는 dependency type별로 다음 규칙을 사용한다.
  - `FS`: successor.start >= predecessor.end`
  - `SS`: successor.start >= predecessor.start`
  - `FF`: successor.end >= predecessor.end`
  - `SF`: successor.end >= predecessor.start`

## 공통 에러/검증 규칙

- `error.not-found.wbs-item`: 참조한 WBS가 프로젝트 범위에 없음
- `error.not-found.wbs-dependency`: 수정/삭제 대상 dependency가 없음
- `error.business.invalid-wbs-period`: `startDate > endDate`
- `error.business.wbs-depth-limit-exceeded`: 최대 depth 초과
- `error.business.wbs-dependency-self-reference`: 자기 자신 dependency
- `error.business.wbs-dependency-cycle`: 순환 dependency 생성 시도
- `error.duplicate.wbs-dependency`: 동일 predecessor/successor/type 중복
- `error.business.wbs-reorder-invalid`: bulk create parent graph 해소 실패

## FE 전환 메모

- 현재 FE workspace는 duplicate/template/bulk-create를 로컬 `createWbsItem` 반복 호출과 localStorage template로 우회 구현 중이다.
- 서버 전환 시 우선순위는 다음과 같다.
  1. bulk create를 `POST /wbs/bulk-create`로 치환
  2. localStorage template 저장/적용을 `/wbs/templates` 계열로 치환
  3. dependency shift preview/apply를 서버 응답 기반으로 치환
- `GET /wbs/dependencies` 응답에는 `projectId`가 없다. FE 타입에서 이를 필수로 가정하지 말아야 한다.
- template/duplicate/instantiate 응답은 생성 item/dependency 전체를 돌려주므로, FE가 즉시 캐시 병합할지 단순 refetch할지 선택 가능하다.

## 이번 heartbeat에서 고정한 검증

- MVC 계약 테스트 추가:
  - duplicate subtree
  - save template
  - instantiate template
  - dependency shift apply
- 기존 서비스 테스트와 합치면 planning/dependency 핵심 계약이 단위 + 컨트롤러 레벨에서 모두 고정된다.
