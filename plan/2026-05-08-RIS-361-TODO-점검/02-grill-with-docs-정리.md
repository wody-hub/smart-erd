# RIS-361 grill-with-docs 정리

## 메모

- 요청된 `gsd-new-project` skill은 현재 세션의 사용 가능 목록에서 찾지 못했다.
- 대신 같은 의도에 가깝게 현재 상황을 문서/용어/후속 결정 질문 중심으로 구조화했다.
- `grill-with-docs` 규칙에 따라, 문서와 코드를 먼저 확인하고 나서 한 번에 하나의 질문만 남긴다.

## 현재 기준선

### 코드 기준

- `My Tasks`는 owner 기준으로 조회되는 개인 TODO 모델이다.
- 상태는 `TODO / IN_PROGRESS / DONE` 3단계다.
- WBS 연결은 선택적 문맥 링크다. WBS 자체를 TODO처럼 다루지는 않는다.
- WBS 패널에서는 연결된 공유 TODO를 보조 정보로 보여 준다.

### 문서 기준

- 기존 분석 문서는 `WBS=구조/범위/책임`, `Gantt=상위 일정 시각화`, `실행은 보드/리스트`라는 방향을 이미 지지한다.
- 따라서 Kanban 논의는 `WBS를 보드화할 것인가`가 아니라 `My Tasks에 실행형 보드 투영을 추가할 것인가`로 질문을 좁혀야 한다.

## 지금까지 정리된 판단

### 이미 거의 확정된 것

- 현재 TODO는 `프로젝트 안의 개인 실행 작업`으로 해석하는 편이 코드와 맞다.
- Kanban v1은 현재 TODO 모델 위에 얹는 projection으로 구현 가능하다.
- v1에서 backend schema 변경은 필수가 아니다.
- v1의 핵심 가치는 `빠른 훑기`와 `빠른 상태 이동`이다.

### 아직 사용자 확인이 필요한 것

- Kanban board의 범위를 어디까지로 볼지
- v1에서 list와 board의 역할을 얼마나 분리할지
- WBS와 board를 어느 수준까지 서로 노출할지

## 첫 번째 질문

### 질문

Kanban board v1의 정체성을 무엇으로 고정할까요?

### 추천 답

`프로젝트 안의 개인 실행 보드`로 고정하는 것이 맞다.

이유:

- 현재 데이터 모델이 owner-scoped `My Task`에 맞춰져 있다.
- `WBS Item`은 구조/범위/책임 허브이고, 실행 카드와 같은 개념으로 합치면 문맥이 흐려진다.
- 지금 단계에서 팀 공용 보드까지 확장하면 권한, 조회 범위, 정렬 규칙, 책임 모델이 한 번에 커진다.
- v1은 `List / Board` 이중 뷰만 추가하고, 팀 공용 execution board는 별도 단계로 분리하는 편이 안전하다.

### 대안

- 대안 A: 개인 보드로 시작한다.
- 대안 B: 처음부터 프로젝트 공용 보드로 확장한다.

현재 추천은 대안 A다.

### 답변 결과

- 선택: `프로젝트 안의 개인 실행 보드`
- 해석: v1 Kanban은 팀 공용 작업 모델이 아니라, 현재 `My Tasks`를 더 빠르게 운영하기 위한 보조 뷰로 고정한다.

## 두 번째 질문

### 질문

v1 Kanban board는 `기존 My Tasks 모델의 다른 뷰`로 갈까요, 아니면 `보드 전용 속성/모델`을 따로 둘까요?

### 추천 답

`기존 My Tasks 모델의 다른 뷰`로 가는 것이 맞다.

이유:

- 현재 범위의 핵심은 새로운 업무 모델을 만드는 것이 아니라, 같은 개인 실행 작업을 더 빠르게 훑고 이동하게 만드는 것이다.
- 기존 CRUD, WBS link, document link, detail panel, query invalidation 흐름을 그대로 재사용할 수 있다.
- 보드 전용 모델을 지금 도입하면 ordering, migration, 권한, 동기화 규칙이 한 번에 커진다.
- 현재 코드와 API는 이미 `status` 기반 상태 이동을 저장할 수 있다.

### 대안

- 대안 A: 같은 `My Tasks` 모델의 list/board 이중 뷰로 간다.
- 대안 B: 보드 전용 정렬/속성을 가진 별도 모델을 도입한다.

현재 추천은 대안 A다.

### 답변 결과

- 선택: `기존 My Tasks 모델의 다른 뷰`
- 해석: v1 Kanban은 별도 보드 모델을 만들지 않고, 현재 TODO CRUD/WBS/document/status 흐름을 그대로 재사용하는 list/board dual view로 간다.

## 세 번째 질문

### 질문

v1 Kanban board에서 같은 컬럼 안 카드 순서를 별도로 저장할까요?

### 추천 답

`저장하지 않는다`가 맞다.

이유:

- 현재 모델에는 카드 순서 필드가 없고, 이 문제를 풀려면 별도 컬럼/마이그레이션/API 계약이 따라온다.
- 지금까지의 결정은 `같은 My Tasks 모델의 가벼운 보드 projection`에 맞춰져 있다.
- v1 핵심 가치는 `빠른 훑기`와 `상태 이동`이지, 정교한 board curation이 아니다.
- 따라서 v1은 기존 정렬 기준을 재사용하고, persistent ordering은 2차 범위로 미루는 편이 일관된다.

### 대안

- 대안 A: 컬럼 내 순서는 저장하지 않고 기존 정렬 기준을 재사용한다.
- 대안 B: 컬럼 내 순서를 저장하는 보드 전용 필드/계약을 도입한다.

현재 추천은 대안 A다.

### 답변 결과

- 선택: `컬럼 내 순서는 저장하지 않는다`
- 해석: v1 Kanban은 상태 이동 중심의 가벼운 projection으로 유지하고, persistent column ordering은 2차 범위로 미룬다.

## 최종 정리

### v1 Kanban 결정 요약

1. v1 Kanban은 `프로젝트 안의 개인 실행 보드`다.
2. v1 Kanban은 `기존 My Tasks 모델의 다른 뷰`다.
3. v1 Kanban은 `컬럼 내 순서를 별도로 저장하지 않는다`.

### 구현 의미

- `My Tasks` 탭은 list/board dual view가 된다.
- 기존 TODO CRUD, status update, WBS link, document link 흐름을 그대로 재사용한다.
- 보드의 핵심 가치는 `빠른 훑기`와 `빠른 상태 이동`이다.
- board-specific ordering, team-shared board, separate model은 모두 2차 이후 논의로 미룬다.

### 이슈 관점 결론

- 원래 질문이었던 `현재 TODO가 타당한가`, `Kanban이 가능한가`에 대해서는 충분히 답이 정리됐다.
- 추가로 `grill-with-docs` 방식으로 v1 Kanban의 범위/모델/정렬 정책까지 닫았다.
