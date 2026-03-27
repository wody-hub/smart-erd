# 10. Phase 1 구현 설계

## 목적

이 문서는 `00-09`에서 정리한 아키텍처를 실제 코드 변경으로 옮기기 위한 첫 구현 설계다.  
목표는 전체 재작성이나 즉시 서비스 분리가 아니라, 현재 `smart-erd` 코드베이스 안에서 아래를 안전하게 시작하는 것이다.

- 협업 플랫폼 코어의 최소 계약을 실제 파일/패키지로 만든다.
- ERD를 첫 번째 plugin 구현체로 감싼다.
- 기존 다이어그램 페이지를 한 번에 갈아엎지 않고, bootstrap과 runtime 진입 경로부터 코어 경계로 옮긴다.
- 첫 vertical slice를 `열기 -> hydrate -> 렌더 -> 1개 mutation -> checkpoint save`까지 통과시킨다.

## Phase 1 범위

### 반드시 포함

- `DocumentMetadataService` / `DocumentBootstrapReader` 기반 bootstrap 경로 도입
- `PluginRegistry` / `EngineRegistry` / `SharedDocumentEngine` 최소 구현
- 프런트 `DocumentPageHost` 수준의 공통 진입 wiring
- ERD plugin의 최소 구현
- Yjs 기반 기본 engine 구현
- `runtime -> persistence` checkpoint 계약의 실제 코드 골격
- read-only bootstrap slice
- 시각 편집 1개 mutation slice
- checkpoint save + reload 검증

### 이번 단계에서 의도적으로 제외

- code editor 전체 경로 재작성
- `dirty-invalid` / `remote-pending` 완전 UI 마감
- generic lock UI 전면 교체
- asset lifecycle의 전체 구현
- 두 번째 plugin 실제 구현
- MSA 분리
- 기존 REST/DB 계약 제거

## 구현 전략 비교

### 옵션 A. 전체 교체

기존 `DiagramPage`, Yjs wiring, 저장 경로를 한 번에 새 구조로 바꾸는 방식이다.

장점:
- 최종 구조에 빨리 도달한다.

단점:
- 영향 범위가 너무 넓다.
- 회귀 지점이 많다.
- ERD 특화 로직과 코어 계약의 책임 경계가 다시 섞일 가능성이 높다.

### 옵션 B. Strangler + Vertical Slice

기존 ERD 경로를 유지하되, 문서 진입과 런타임 경계를 공통 코어로 감싸고, 작은 기능 단위로 교체하는 방식이다.

장점:
- 회귀 범위를 제어할 수 있다.
- 코어 계약의 빈칸을 실제 구현으로 검증할 수 있다.
- 첫 성공 기준을 빠르게 세울 수 있다.

단점:
- 과도기 adapter 코드가 잠시 늘어난다.

### 권장안

Phase 1은 반드시 옵션 B로 간다.

이유:

1. 지금 목적은 “예쁜 새 구조”가 아니라 “재사용 가능한 코어 경계 검증”이다.
2. 가장 비싼 실패는 대규모 재작성 후 ERD 특화 예외 규칙이 다시 코어에 새는 것이다.
3. 두 번째 plugin까지 고려하면, 먼저 작은 성공 경로를 확보하는 편이 훨씬 안전하다.

## Phase 1 완료 조건

아래가 모두 만족되면 Phase 1 완료로 본다.

1. `DiagramPage`가 plugin/engine/bootstrap 정보를 공통 host 경로로 받아 초기화한다.
2. ERD가 `ErdDocumentPlugin` 형태의 첫 plugin으로 등록된다.
3. Yjs가 `SharedDocumentEngine` 구현체로 등록된다.
4. 기존 다이어그램이 snapshot 또는 fallback 경로로 정상 hydrate 된다.
5. 최소 1개의 시각 편집 mutation이 새 코어 경로를 통해 반영되고 원격 전파된다.
6. checkpoint save 후 reload했을 때 같은 상태가 복원된다.
7. 새 코어 패키지에는 `table`, `edge`, `dsl`, `reactflow`, `monaco` 같은 용어가 없다.

## 구현 원칙

1. 기존 페이지 엔트리는 유지하고 내부 wiring만 교체한다.
2. Phase 1의 첫 mutation은 code path가 아니라 canvas path에서 고른다.
3. 저장 계약은 줄이지 말고 감싼다.
4. 기존 REST/WS 계약은 adapter 뒤에 둔다.
5. draft state machine은 먼저 계약과 store만 만들고, code editor 전면 전환은 다음 단계로 미룬다.

## 현재 코드에서 시작할 지점

### 프런트엔드

현재 구현의 실제 진입점은 아래다.

- `client/src/pages/diagram/DiagramPage.tsx`
- `client/src/collaboration/channel/diagram/use-diagram-collaboration-runtime.ts`
- `client/src/collaboration/core/use-collaboration-session.ts`
- `client/src/collaboration/yjs/*`
- `client/src/stores/erd/useCanvasStore.ts`

Phase 1에서는 이 구조를 바로 없애지 않는다.  
대신 `DiagramPage`를 얇게 만들고, diagram 전용 runtime hook을 공통 host adapter 뒤로 밀어 넣는다.

### 백엔드

현재 구현의 실제 시작점은 아래다.

- `src/main/java/com/smarterd/collaboration/channel/*`
- `src/main/java/com/smarterd/domain/diagram/collaboration/*`
- `src/main/java/com/smarterd/domain/diagram/websocket/*`
- `src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotService.java`

Phase 1에서는 현재 diagram channel 기반 협업을 유지하면서, metadata/bootstrap/persistence를 공통 계약으로 감싸는 방향으로 간다.

## 권장 패키지 및 파일 배치

### 프런트엔드 신규/정리 대상

```text
client/src/collaboration/
├── core/
│   ├── contracts/
│   │   ├── document-plugin.ts
│   │   ├── shared-document-engine.ts
│   │   ├── document-metadata.ts
│   │   ├── document-bootstrap.ts
│   │   ├── document-snapshot-codec.ts
│   │   └── document-checkpoint.ts
│   ├── session/
│   │   ├── document-page-host.ts
│   │   ├── document-session-bootstrap.ts
│   │   └── document-session-context.ts
│   ├── store/
│   │   ├── document-store.ts
│   │   ├── change-bus.ts
│   │   └── document-read-executor.ts
│   ├── runtime/
│   │   ├── collaboration-runtime.ts
│   │   ├── presence-runtime.ts
│   │   └── scope-lock-runtime.ts
│   ├── persistence/
│   │   ├── document-persistence-client.ts
│   │   └── persistence-coordinator.ts
│   ├── draft/
│   │   ├── draft-state.ts
│   │   └── draft-reconcile-coordinator.ts
│   └── engines/
│       └── yjs-shared-document-engine.ts
│
├── registry/
│   ├── document-plugin-registry.ts
│   └── shared-document-engine-registry.ts
│
└── plugins/
    └── erd/
        ├── erd-document-plugin.ts
        ├── adapters/
        ├── projectors/
        ├── text/
        ├── query/
        ├── artifact/
        ├── assets/
        ├── presence/
        └── scope/
```

### 백엔드 신규/정리 대상

```text
src/main/java/com/smarterd/collaboration/
├── metadata/
│   ├── DocumentMetadata.java
│   ├── DocumentMetadataService.java
├── document/
│   ├── SharedDocumentEngine.java
│   ├── SharedDocumentEngineRegistry.java
│   ├── DocumentCheckpoint.java
│   └── DocumentSnapshotCodec.java
├── persistence/
│   ├── DocumentBootstrapReader.java
│   ├── DocumentPersistenceCoordinator.java
│   └── PersistedDocument.java
├── plugin/
│   ├── BaseCollaborationPlugin.java
│   ├── CollaborationPluginRegistry.java
│   └── capability/*
└── runtime/
    ├── CollaborationRuntimeFacade.java
    └── DocumentRoomManager.java
```

핵심은 새 패키지를 전부 한 번에 구현하는 게 아니라, 기존 diagram 전용 구현을 감싸는 골격부터 만드는 것이다.

## Phase 1에서 먼저 만들 최소 계약

### 프런트엔드

반드시 먼저 정의할 계약:

- `DocumentMetadata`
- `DocumentBootstrapHeader`
- `DocumentPluginRegistry`
- `SharedDocumentEngineRegistry`
- `BaseDocumentPlugin`
- `SharedDocumentEngine`
- `DocumentSnapshotCodec`
- `DocumentReadExecutor`
- `PersistenceCoordinator`
- `DraftState`

Phase 1에서는 이 계약들의 첫 구현체만 있으면 된다.

- plugin = `ErdDocumentPlugin`
- engine = `YjsSharedDocumentEngine`
- page host = `DiagramPage` 내부에서 사용하는 document host adapter

### 백엔드

반드시 먼저 정의할 계약:

- `DocumentMetadataService`
- `DocumentBootstrapReader`
- `DocumentCheckpoint`
- `DocumentSnapshotCodec`
- `DocumentPersistenceCoordinator`
- `CollaborationPluginRegistry`
- `BaseCollaborationPlugin`

Phase 1의 핵심은 기존 `diagram` 전용 snapshot/handoff 경로를 바로 제거하는 것이 아니라, 이 계약 뒤에 연결하는 것이다.

## Bootstrap API 방침

Phase 1에서는 기존 `fetchDiagram` 응답에 `pluginId`, `engineId`를 억지로 섞지 않는다.  
현재 [DiagramDetailResponse.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/api/diagram/dto/DiagramDetailResponse.java) 와 [diagram.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/types/diagram.ts) 는 기존 ERD 상세/`content` 계약을 이미 소비하고 있으므로, 첫 구현에서 이 응답까지 동시에 바꾸면 영향 범위가 커진다.

따라서 HTTP 경계는 아래처럼 가져간다.

```text
GET /teams/{teamId}/projects/{projectId}/diagrams/{diagramId}/bootstrap
  -> {
       pluginId,
       engineId,
       pluginSchemaVersion,
       snapshotFormatVersion,
       artifactVersion,
       revision,
       snapshotAvailable,
       artifactAvailable
     }
```

규칙:

1. 이 bootstrap endpoint는 네트워크 계약일 뿐이고, 내부 ownership은 그대로 분리한다.
2. `pluginId`, `engineId`, ACL은 `DocumentMetadataService`가 authoritative 하게 제공한다.
3. `pluginSchemaVersion`, `snapshotFormatVersion`, `artifactVersion`, `revision`, snapshot/artifact 존재 여부는 `DocumentBootstrapReader`가 authoritative 하게 제공한다.
4. backend controller/application 계층이 두 결과를 조합해 bootstrap 응답을 만든다.
5. 프런트 `DocumentPageHost`는 먼저 bootstrap endpoint를 호출하고, 기존 `fetchDiagram`은 UI/detail/content fallback용으로 유지한다.
6. Phase 1에서는 [diagramApi.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/api/diagramApi.ts) 에 `fetchDiagramBootstrap()`를 추가하는 방식을 기본값으로 둔다.
7. 프런트는 `DocumentMetadataService`나 `DocumentBootstrapReader`를 직접 호출하지 않는다. 프런트의 유일한 진입점은 HTTP bootstrap API다.

이 방침을 쓰면:

- 아키텍처 문서의 metadata/persistence ownership 분리를 유지할 수 있다.
- 기존 `DiagramDetail` 타입을 한 번에 깨지 않는다.
- `DocumentPageHost`가 실제로 필요한 bootstrap 메타만 먼저 읽을 수 있다.

## Slice 1 hydrate payload 방침

Phase 1의 read-only open은 아래 순서로 고정한다.

```text
1. fetchDiagramBootstrap()
2. fetchDiagram()
3. live collaboration join
4. WS handoff/snapshot request
5. snapshot 도착 시 SharedDocumentEngine hydrate
6. snapshot 미도착 timeout 시 fetchDiagram().content 로 fallback hydrate
```

규칙:

1. Phase 1에서는 REST로 binary snapshot payload를 직접 받지 않는다.
2. snapshot payload의 primary source는 기존 WS handoff / snapshot request 경로를 재사용한다.
3. `fetchDiagram().content`는 fallback hydrate source로만 사용한다.
4. `DocumentBootstrapHeader.snapshotAvailable=true` 여도 WS handoff가 실패하면 timeout 후 fallback hydrate를 허용한다.
5. `DocumentSnapshotCodec`는 persistence 저장 포맷과 in-memory snapshot 사이 변환을 담당하지만, Slice 1의 첫 hydrate transport는 기존 WS snapshot 경로를 그대로 쓴다.
6. 이 경로는 현재 [use-diagram-collaboration-runtime.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/collaboration/channel/diagram/use-diagram-collaboration-runtime.ts) 의 preview/fallback 정책을 대체하는 것이 아니라, `DocumentPageHost + SharedDocumentEngine` 경계 뒤로 옮기는 것이 목적이다.

## Phase 1 vertical slice 설계

### Slice 1. Bootstrap + Read-Only Open

가장 먼저 통과시킬 경로:

```text
DiagramPage
  -> DocumentPageHost
  -> fetchDiagramBootstrap()
  -> fetchDiagram()
  -> PluginRegistry / EngineRegistry
  -> live collaboration join
  -> WS handoff / snapshot request
  -> SharedDocumentEngine hydrate
  -> Projector
  -> ERD canvas read-only render
```

이 slice의 목적:

- 문서 진입 책임을 공통 host로 옮긴다.
- `pluginId`, `engineId` 기반 선택이 실제 코드에서 작동하는지 검증한다.
- snapshot hydrate와 fallback hydrate 경계를 검증한다.

이 slice에서는 편집을 아직 새 구조로 넘기지 않는다.

### Slice 2. 시각 편집 1개 Mutation

두 번째로 통과시킬 경로:

```text
Canvas Adapter
  -> Erd Input Adapter
  -> Mutation Policy
  -> DocumentStore
  -> ChangeBus
  -> CollaborationRuntime
  -> PersistenceCoordinator
```

첫 mutation은 `table position move`로 제한한다.

이유:

- text draft를 건드리지 않는다.
- dictionary/export/save source 같은 부수 효과가 상대적으로 적다.
- delta 반영과 checkpoint 저장을 검증하기 좋다.

### Slice 3. Checkpoint Save + Reload

세 번째로 통과시킬 경로:

```text
DocumentStore exportSnapshot
  -> PersistenceCoordinator checkpoint
  -> backend DocumentPersistenceCoordinator
  -> reload
  -> same snapshot hydrate
```

이 slice의 목적:

- `runtime -> persistence` 전달 규칙을 실제 경로로 검증한다.
- future split 대비 `at-least-once + idempotent persistence` 계약을 지금부터 반영한다.

## 코드 편집 경로는 왜 Phase 1 후반으로 미루는가

현재 가장 심한 장애는 code path에서 발생했지만, 구현 순서상 첫 slice는 code path가 아니다.

이유:

1. code path는 `draft`, `parse`, `remote-pending`, `rebase`, `save guard`가 모두 엮여 있다.
2. bootstrap과 시각 편집 경계를 먼저 정리하지 않으면 code path를 넣는 순간 예외 규칙이 코어로 다시 샌다.
3. 먼저 canvas mutation 하나로 코어 경계를 검증한 뒤, 다음 단계에서 text input pipeline과 draft coordinator를 붙이는 편이 안전하다.

Phase 1에서는 아래까지만 한다.

- `DraftState` 계약 정의
- `DraftReconcileCoordinator` 골격 생성
- `DiagramPage`와 code panel이 이 상태를 읽을 준비만 함

실제 code apply/rebase UI 전환은 Phase 2에서 진행한다.

## 기존 코드와의 연결 방식

### 프런트엔드 연결 전략

1. `DiagramPage.tsx`는 그대로 엔트리로 유지한다.
2. 페이지 내부 bootstrap/wiring 코드를 `DocumentPageHost` 성격의 공통 hook/host로 이동한다.
3. `use-diagram-collaboration-runtime.ts`는 즉시 삭제하지 않고, `ErdDocumentPlugin`의 임시 adapter 역할로 축소한다.
4. current Yjs adapter는 첫 `SharedDocumentEngine` 구현의 내부 의존성으로 재사용할 수 있다.
5. `useCanvasStore`는 끝까지 ERD projection/UI store로만 남는다.
6. 새 `DocumentStore`가 권위 상태 경계이고, `useCanvasStore`는 projector/store bridge를 통해 갱신된다.
7. Phase 1에서 `useCanvasStore`를 `DocumentStore`의 별칭이나 임시 구현으로 사용하면 안 된다.

### 백엔드 연결 전략

1. 현재 `collaboration/channel/*` registry 계층은 유지한다.
2. `DiagramCollaborationChannelPlugin`은 Phase 1에서 첫 `plugin-domain` adapter로 본다.
3. 현재 diagram snapshot 저장 로직은 `DocumentPersistenceCoordinator` 뒤에서 호출되게 감싼다.
4. 현재 diagram websocket relay는 `collaboration-runtime`의 첫 구현으로 유지하되, 새 계약을 따르도록 adapter를 둔다.

## 실제 작업 순서

### Step 1. 계약 파일 추가

프런트/백엔드에 아래 계약 파일만 먼저 추가한다.

- metadata
- bootstrap
- snapshot codec
- plugin registry
- engine registry
- checkpoint
- draft state

이 단계에서는 런타임 동작 변경을 최소화한다.

### Step 2. Bootstrap Host 도입

`DiagramPage`에서 아래를 분리한다.

- bootstrap endpoint 호출
- 기존 detail fetch 호출
- plugin/engine 선택
- runtime/store/persistence wiring

이 단계가 끝나면 `DiagramPage`는 ERD UI 조립과 page-level query만 남아야 한다.

### Step 3. ERD Plugin 최소 구현

우선 아래만 구현한다.

- `pluginId = erd`
- `supportedEngineIds = ['yjs']`
- projector
- canvas input adapter
- mutation policy
- scope resolver

text input pipeline은 placeholder 또는 thin adapter만 두고, 주 경로로 쓰지 않는다.

### Step 4. Yjs Engine 등록

현재 Yjs adapter를 `SharedDocumentEngine` 구현으로 감싼다.  
이때 persistence 입출력 포맷은 `DocumentSnapshotCodec`가 담당하고, engine은 in-memory hydrate/export/apply만 담당한다.

이 단계의 성공 기준:

- snapshot hydrate
- snapshot export
- remote delta apply

### Step 5. 첫 Mutation 연결

`table position move`를 새 경로에 연결한다.

이때 확인할 것:

- local mutation
- change bus publish
- remote relay
- projector 갱신
- checkpoint dirty mark

### Step 6. Checkpoint Save 연결

기존 diagram snapshot persist 경로를 `DocumentPersistenceCoordinator` 뒤에서 호출한다.

이 단계에서 꼭 유지할 것:

- 기존 저장 API 재사용
- `documentId + revision` 기준 중복 저장 허용
- 실패 시 runtime authoritative state는 rollback하지 않음

## 검증 시나리오

Phase 1 검증은 아래 시나리오를 기준으로 한다.

### 기능 검증

1. 기존 ERD 문서 열기
2. snapshot hydrate 성공
3. snapshot이 없을 때 fallback hydrate 성공
4. read-only 렌더 정상
5. 테이블 이동 1건 반영
6. 다른 클라이언트에 원격 반영
7. checkpoint save 후 새로고침 시 상태 유지

### 회귀 검증

1. 기존 협업 입장/재입장 실패하지 않음
2. preview/degraded 진입 규칙 깨지지 않음
3. 저장 실패 시 페이지가 즉시 깨지지 않음
4. 기존 code editor path는 아직 새 경로로 강제 전환하지 않음

### 구조 검증

1. 새 core 디렉터리에 ERD 전용 용어가 없음
2. `DiagramPage`의 bootstrap 책임이 줄어듦
3. plugin/engine 선택이 registry 기반으로 동작
4. checkpoint 호출이 page/component가 아니라 coordinator 경유로만 일어남

## 리스크와 완화

| 리스크 | 완화 |
|------|------|
| 공통 host를 도입하다가 기존 diagram page가 더 복잡해짐 | 첫 단계는 wrapper 추가 후 기존 코드 이동만 수행하고 기능 변경은 최소화 |
| ERD plugin이 결국 기존 diagram runtime의 다른 이름이 됨 | Phase 1 완료 조건에 `pluginId`, `supportedEngineIds`, registry 등록을 명시 |
| save 경로가 이중화됨 | page 직접 저장 호출을 늘리지 말고 coordinator 뒤에서 기존 API를 재사용 |
| code path를 너무 일찍 건드려 다시 커서/overwrite 회귀가 남 | code apply는 다음 단계로 미루고 draft state skeleton만 반영 |
| 백엔드 계약만 만들고 실제 diagram 경로는 그대로여서 문서와 구현이 어긋남 | 첫 checkpoint/load 경로는 반드시 새 coordinator 이름으로 감싸서 호출 |

## Phase 1 이후 바로 이어질 작업

Phase 1이 끝나면 다음 순서는 아래다.

1. text input pipeline 실구현
2. `DraftReconcileCoordinator` 활성화
3. `dirty-invalid` / `remote-pending` 저장 가드 연결
4. ERD serializer / artifact codec 분리
5. generic lock runtime 도입 범위 확대

즉 Phase 1은 “코어 계약을 실제로 서게 만드는 최소 구현”이고,  
Phase 2부터가 본격적인 ERD plugin 추출과 code path 재구성 단계다.

## 현재 진행 메모 (2026-03-26)

### 현재까지 완료한 범위

- bootstrap endpoint / host 경로 도입
- `PluginRegistry` / `EngineRegistry` / `YjsSharedDocumentEngine` 최소 구현
- `DocumentStore` / `DocumentRevisionTracker` / `DocumentPersistenceCoordinator` 골격 연결
- `DocumentMutationSession` 도입 및 result-bearing command 지원
- `DocumentStore -> projector -> persisted canvas refresh` 경로 연결
- published save / code-mode snapshot persist를 diagram channel 세션 경계로 이동
- autosave 로컬 변경 감지를 `Y.Doc` 직접 구독이 아니라 `DocumentChangeEvent` 기준으로 전환
- code editor / apply / refresh read를 `diagram` 채널 read snapshot 경계로 이동
- DDL/DSL 공통 revision hash 계산과 command feedback 공통화
- `DiagramPage`의 bootstrap/detail/runtime/save/code-mode persist 조립을 `use-diagram-document-session`으로 이동
- `use-diagram-collaboration-runtime` 을 `bootstrap 해상` / `document runtime 조립` 조각으로 분해
- 기존 `useYjsCollaboration` 을 제거하고 `use-diagram-collaboration-session` 으로 channel 경계에 정리
- published save / code-mode snapshot persist를 `use-diagram-document-persistence` 로 한 번 더 묶어 session 조립을 단순화
- `DiagramPage`의 work mode / panel / preview / overlay latch 파생 계산과 effect를 `use-diagram-page-runtime-state` 로 이동
- `DiagramPage`의 validation / dictionary dialog / left panel / export action 상태를 `use-diagram-page-controls` 로 이동
- `shared schema draft` 의 Y.Doc observe/write 경계를 `use-diagram-shared-schema-draft` 로 이동하고, preview 위치의 즉시 반응 상태는 page에 유지
- projector의 remote/system refresh를 `nodes/edges/groups` 타입 단위에서 `nodeIds/edgeIds/groupIds` 기준 partial refresh로 축소
- `useCodeEditorRefresh` 는 graph read를 직접 모르고 `generateFromErd` orchestration만 담당하도록 축소
- `useDiagramErdReadSnapshot` 는 `hasNodes`, `readCurrentRevisionHash` 를 제공해 code/apply 경로의 중복 graph-hash 계산을 줄임
- `DraftState` 를 `useBidirectionalCodeSync` 에 실제 연결하고, DSL 최종 저장은 `remote-pending` / `dirty-invalid` 상태에서 overwrite guard를 갖도록 정리
- `DraftState` 를 footer/apply 경계까지 확장해서, DDL/DSL 모두 `remote-pending` 상태에서 Apply를 막고 공통 상태 메타를 footer에 노출
- `DocumentChangeEvent` 에 `origin` 과 별도로 engine transaction origin을 분리해, autosave는 local 의미를 유지하면서 projector refresh는 실제 `remote/system` Y.Doc origin 기준으로 동작하게 정리
- `applyDiffPlan`을 세션 경계로 이동
- dictionary reconciliation을 `diagram` 채널 경계로 이동
- ERD mutation의 주요 편집 축을 새 경로로 이동
  - `table:add/delete/move/rename/update-meta`
  - `column:add/delete/move/update`
  - `edge:connect/delete/add-fk-relation`
  - `edge:update-routing-type/update-handle-selection/update-waypoints/reset-waypoints/normalize-handles`
  - `group:add/delete/rename/update-color/update-tables`
  - `ddl:import`
  - `ddl:replace`
- UI 직접 fallback 중복 일부를 channel action hook으로 정리
  - `use-diagram-erd-crud-actions`
  - `use-diagram-erd-edge-actions`
  - `use-diagram-erd-apply-actions`
  - `use-diagram-dictionary-reconciliation-actions`
  - `use-diagram-preview-position-actions` 일부
- `preview position` fallback도 `DiagramCollaborationStoreBridge` 뒤로 올려, channel action 훅이 canvas store 구현을 직접 알지 않게 정리
- ERD read 경계를 `nodes-only` / `structure(nodes+edges)` / `groups reader` / `full graph`로 나눠, dictionary / DDL / DSL / apply runtime이 모두 같은 full graph snapshot 기본 경로를 강제하지 않게 정리
- `apply runtime` 도 `nodes + structure` 이중 구독을 없애고 `structure + groups reader` 기준으로 정리했으며, broad `useDiagramErdReadSnapshot()` public surface는 제거했다.
- projector의 drag defer 경로도 `targets`만 보존하던 큐를 `nodeIds / edgeIds / groupIds`까지 유지하도록 바꿔, 드래그 종료 후 flush가 다시 broad refresh로 넓어지지 않게 정리했다.
- `DiagramPage`가 직접 들고 있던 `tableFocusRequest / tableCodeRevealRequest / dslPreviewState / dslPreviewPositionOverrides` 상태 소유권을 `use-diagram-page-runtime-state` 로 옮겨, page-level setter 전달과 preview/code-navigation wiring을 더 줄였다.
- 추가로 `diagramName / activeGroupId / initialLoadComplete` 도 `use-diagram-page-runtime-state` 안으로 옮겨, `DiagramPage` 에 남는 page-local 상태를 `workMode / workModeHydrated` 중심으로 더 줄였다.

### 현재까지 확인한 검증

- `client`: `npm run build` 통과
- `server`: `./gradlew compileJava` 통과
- Playwright 스모크 통과
  - `diagram-collaboration.spec.ts`
  - `diagram-dictionary-reentry-reconciliation.spec.ts`
  - `diagram-work-mode-shared-draft.spec.ts` 의 shared draft / matched node move 시나리오
- page/runtime 정리 이후 최신 `diagram-collaboration.spec.ts` 재통과
- 최신 DraftState footer/apply gating 변경 이후 `client` `npm run build` 재통과
- incremental refresh / code read 정리 이후 최신 `diagram-collaboration.spec.ts` 재통과
- draft reconcile state 연결 이후 최신 `client npm run build` 재통과
- shared-draft 묶음 실행 종료 행은 현재 재현되지 않았다.
  - 동일 묶음 실행을 반복 루프로 다시 돌렸을 때 최신 10회는 전부 통과했다.
  - 따라서 현시점에서는 앱 구조 blocker가 아니라 `추가 증거 확보 전까지 deferred` 로 분류한다.
- `diagram-work-mode-shared-draft.spec.ts` 는 장시간 대기 1회와 assertion 실패 1회를 거친 뒤,
  `shared draft observe/write 경계` 와 `preview 위치 상태 소유권`을 다시 조정한 뒤 최신 재실행에서 재통과했다.
- `diagram-auto-apply-layout-and-domain-focus.spec.ts` 의 code auto apply 시나리오도 최신 재검증에서 통과했다.
  - 원인은 `local 요청 + system transaction` 이 `DocumentChangeEvent.origin` 하나에 합쳐져,
    canvas observer는 projector refresh를 defer했지만 projector는 local event로 보고 refresh를 건너뛰던 경계 불일치였다.
  - 수정 후 auto apply는 `full-replace` 경로에서도 canvas projection이 정상 반영된다.
- `diagram-preview-lock.spec.ts` 는 persistent 계정/env 의존을 제거하고 self-provision + 초기 content seed + 선행 backup으로 재작성한 뒤 최신 재통과했다.
- broad smoke 묶음도 최신 재실행에서 모두 통과했다.
  - `diagram-collaboration.spec.ts`
  - `diagram-dictionary-reentry-reconciliation.spec.ts`
  - `diagram-work-mode-shared-draft.spec.ts`
  - `diagram-auto-apply-layout-and-domain-focus.spec.ts`
  - `diagram-work-mode-three-account-collaboration.spec.ts`
  - `diagram-preview-lock.spec.ts`
- 최신 read-authority 정리 이후 targeted smoke도 재통과했다.
  - `diagram-dictionary-reentry-reconciliation.spec.ts`
  - `diagram-work-mode-shared-draft.spec.ts`
  - `diagram-auto-apply-layout-and-domain-focus.spec.ts`
- latest cleanup review 대응 이후에도 `client npm run build`, `diagram-dictionary-reentry-reconciliation.spec.ts`, `diagram-auto-apply-layout-and-domain-focus.spec.ts` 가 재통과했다.
- latest `DiagramPage` runtime state 소유권 정리 이후에도 `client npm run build`, `diagram-work-mode-shared-draft.spec.ts` 의 `code mode shared draft is visible across sessions and matched node moves persist` 가 재통과했다.
- latest `diagramName / activeGroupId / initialLoadComplete` 상태 이동 이후에도 `client npm run build`, `diagram-work-mode-shared-draft.spec.ts` 의 `code mode shared draft is visible across sessions and matched node moves persist` 가 재통과했다.
- latest projector deferred refresh id 보존 정리 이후에도 `client npm run build`, `diagram-collaboration.spec.ts`, `diagram-work-mode-shared-draft.spec.ts` 의 `code mode shared draft is visible across sessions and matched node moves persist` 가 재통과했다.

### 아직 남아 있는 우선 작업

1. 브라우저 통합 검증
- 로컬 편집, 원격 반영, save/reload, 재진입, code apply, DDL import/replace, dictionary reconcile을 실제 런타임에서 재현 검증
- shared-draft 묶음 실행 종료 이슈는 다시 터질 때만 artifact를 보존해 재조사한다. 지금은 수정 대상이 아니라 관측 대상이다.
- 현재 핵심 smoke 묶음은 모두 닫혔다. 남은 검증은 broad regression 유지와 deferred 관측 항목 관리다.

2. `DiagramPage` / runtime 오케스트레이션 축소
- `DiagramPage` 와 diagram channel 훅들에 남아 있는 overlay / dialog / work-mode 주변 조합 책임을 더 얇게 만들기
- page는 화면 상태와 wiring만, runtime은 조립만, channel/session은 행위만 갖도록 재정리

3. read authority 추가 정리
- `useDiagramErdReadSnapshot()` 의 canvas projection fallback은 제거했지만, apply/code/read 전 경로가 문서 read를 일관되게 우선하는지 추가 점검
- 남아 있는 full graph 의존은 주로 `groups` 가 필요한 경로와 일부 on-demand graph read 쪽이라, targeted query를 더 내려야 하는지 마지막 판단 필요

4. projector/read model 고도화
- 현재 scope-aware refresh는 들어갔지만, 일부 경로는 여전히 full refresh fallback을 사용한다.
- large diagram 기준 incremental projector/read model로 더 좁혀야 함

5. save/reload / stale UX 검증 및 보완
- `content`와 `ydocSnapshot` 저장 시점 정합성 추가 확인
- 409/stale 처리 후 UX와 재동기화 정책 점검

6. code path 2차 전환 준비
- `DraftState` / reconcile state machine을 실제 code editor 경로에 연결
- `dirty-invalid`, `remote-pending`, overwrite guard를 새 경계에 맞춰 재구성

### 다음 우선순위

지금 시점의 최우선은 broad 통합 검증 유지와 남은 page/runtime 상태 조합 정리다.  
shared-draft 묶음 실행 이슈는 현재 비재현이라 deferred로 두고, mutation/save/apply/dictionary/code read 경계 위에 남아 있는 오케스트레이션만 줄여간다.
