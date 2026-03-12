# 2026-03-11 ERD Undo/Redo 구현 설계

작성일: 2026-03-11
상태: 설계 확정 초안

## 배경

현재 ERD 편집기에서는 테이블/컬럼/관계/그룹/레이아웃 변경 후 `Cmd+Z` / `Ctrl+Z`로 직전 상태를 되돌릴 수 없다.

사용자는 다음과 같은 편집 흐름에서 즉시 복구 수단이 필요하다.

- 테이블 위치를 잘못 옮긴 경우
- 컬럼/관계를 실수로 삭제한 경우
- FK 연결이나 자동 배치를 실행한 뒤 직전 상태로 돌아가고 싶은 경우
- 그룹 편집 중 대량 선택/이동을 잘못 수행한 경우

이 프로젝트의 ERD 캔버스는 단순 React state가 아니라 `Y.Doc + Zustand projection` 구조를 사용한다.
따라서 일반적인 React Flow snapshot history를 그대로 적용하면 협업 반영, autosave, preview handoff와 충돌할 수 있다.

## 목표

이번 1차 구현에서 다음을 달성한다.

1. ERD 캔버스 직접 조작에 대해 `undo` / `redo`를 제공한다.
2. 키보드 단축키:
   - `Cmd+Z` / `Ctrl+Z` → Undo
   - `Cmd+Shift+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` → Redo
3. 원격 협업 변경은 로컬 undo stack에 섞이지 않게 한다.
4. preview hydration, fallback hydration, 초기 Y.Doc bootstrap은 undo 대상에서 제외한다.
5. 드래그/연속 편집은 과도하게 잘게 쪼개지지 않도록 1개 작업 단위로 묶는다.

## 비목표

이번 1차 범위에서 아래는 제외한다.

1. DSL/DDL 코드 에디터 내부 텍스트 undo/redo
2. Code → ERD 자동 반영 결과의 undo/redo
3. DDL Import / Replace 전체 적용 결과의 undo/redo
4. 서버 저장 이력 관리 또는 버전 스냅샷 기능
5. 멀티 유저 공동 undo
6. 브라우저 native history API 또는 `beforeinput/historyUndo` 의존 구현

## 최근 구현 동향 요약

### 1. React Flow 단독 앱은 snapshot 기반 undo/redo를 많이 사용

- React Flow 공식 예제는 전체 `nodes/edges` snapshot을 쌓는 방식을 소개한다.
- 단일 사용자, 로컬 상태 중심 앱에는 단순하고 효과적이다.

하지만 이 프로젝트는 React Flow state가 원본이 아니다.
실제 데이터의 authoritative source는 `Y.Doc`이며, `nodes/edges/groups`는 Yjs 상태를 투영한 결과다.
따라서 React Flow snapshot만 되돌리면 Y.Doc / WS / autosave와 불일치가 발생한다.

### 2. 협업 편집기에서는 CRDT/OT 레이어의 selective undo가 일반적

- Yjs는 `UndoManager`를 제공하며 `trackedOrigins`, `captureTimeout`, `stopCapturing()`으로
  로컬 변경만 선택적으로 undo stack에 기록할 수 있다.
- 원격 변경과 시스템 마이그레이션을 제외할 수 있어 협업형 ERD 편집기 구조와 더 잘 맞는다.

### 3. 브라우저 native undo 이벤트는 보조 수단이지 캔버스 상태 관리 수단이 아님

- `beforeinput`의 `historyUndo`, `historyRedo`는 텍스트 입력 계열에서는 유용하지만,
  캔버스/CRDT 상태 전체를 안정적으로 다루는 용도로는 부적합하다.
- 특히 Monaco, input, textarea, IME와 혼재한 환경에서는 앱 레벨 history와 분리해야 한다.

## 핵심 결정

### 결정 1. 히스토리는 Zustand snapshot이 아니라 `Y.UndoManager`로 구현한다

이유:

- 현재 로컬 변경 진입점이 대부분 `ydoc.transact(...)`다.
- autosave는 Y.Doc 업데이트 origin을 기준으로 로컬/원격을 구분한다.
- 원격 변경은 이미 `Y.applyUpdate(..., 'remote')`로 반영된다.
- 따라서 undo도 동일 계층(Yjs)에서 처리해야 정합성이 유지된다.

### 결정 2. Undo stack은 “로컬 사용자 조작”만 추적한다

포함:

- 테이블 추가/삭제/이름 변경/메타 수정
- 컬럼 추가/삭제/수정/순서 변경
- FK 연결 및 엣지 삭제
- 그룹 추가/삭제/이름 변경/색상 변경/그룹 소속 변경
- 노드 이동
- 자동 배치 결과

제외:

- 원격 변경 (`origin === 'remote'`)
- preview hydration
- fallback hydration
- 초기 `initYDoc`
- snapshot handoff
- Code → ERD 자동 반영
- DDL Import / Replace

추가 정책:

- 원격 변경을 받았다고 해서 로컬 undo stack을 즉시 비우지는 않는다.
- 1차 구현에서 undo의 의미는 “내가 만든 로컬 변경을 되돌리는 새 협업 변경”이다.
- 따라서 원격 변경 수신 후 undo 실행은 허용하되, 과거 시점으로 문서를 강제 롤백하는 기능으로 해석하지 않는다.
- undo 결과는 현재 최신 문서 위에 적용되는 새로운 Yjs update이며, 다른 사용자의 최신 변경 일부를 다시 바꿔 보일 수 있다.
- 1차에서는 stack 유지 정책을 채택하고, conflict-aware undo UX는 2차 과제로 남긴다.

### 결정 3. 모든 로컬 transact에 명시적 origin을 부여한다

현재 대부분의 `ydoc.transact()` 호출은 origin이 비어 있다.
이 상태에서는 어떤 변경이 사용자 조작이고 어떤 변경이 시스템 반영인지 `UndoManager`가 구분하기 어렵다.

따라서 새 상수 집합을 도입한다.

```text
CANVAS_HISTORY_ORIGIN.USER_TABLE
CANVAS_HISTORY_ORIGIN.USER_COLUMN
CANVAS_HISTORY_ORIGIN.USER_EDGE
CANVAS_HISTORY_ORIGIN.USER_GROUP
CANVAS_HISTORY_ORIGIN.USER_LAYOUT
CANVAS_HISTORY_ORIGIN.SYSTEM_PREVIEW
CANVAS_HISTORY_ORIGIN.SYSTEM_FALLBACK
CANVAS_HISTORY_ORIGIN.SYSTEM_CODE_SYNC
CANVAS_HISTORY_ORIGIN.SYSTEM_DDL_IMPORT
DRAG_TRANSACTION_ORIGIN
```

origin 표현 규칙:

- 일반 편집 action은 문자열 상수 origin을 사용한다.
- drag만은 기존 observer skip 최적화와 결합되어 있으므로 예외적으로 shared token 객체 origin을 사용한다.
- 즉 1차 구현의 origin 체계는 “일반 action = 문자열 상수, drag = shared token 객체”로 고정한다.

실제 `trackedOrigins`에는 `USER_*` 문자열 상수와 drag token만 넣는다.

### 결정 4. 텍스트 입력 중 `Cmd+Z`는 캔버스 undo가 아니라 입력 컴포넌트 기본 동작을 우선한다

적용 대상:

- 일반 `input`, `textarea`
- contenteditable
- Monaco editor

즉, 캔버스 단축키는 “캔버스 포커스/비텍스트 포커스 상태”에서만 동작해야 한다.

### 결정 5. 1차에서는 대량 자동 변경 기능을 undo 대상에서 제외한다

제외 대상:

- `replaceFromDdl`
- `importDdl`
- `applyDiffPlan`
- Code → ERD apply 경로

이유:

- 변경량이 크고, 협업 중 원격 반영과 섞일 가능성이 높다.
- 기존 sync/preview/recovery 경계가 복잡해 회귀 위험이 크다.
- 1차 목표는 일상적인 직접 조작 복구성 확보다.

### 결정 6. rename / inline edit는 commit 단위만 undo 대상으로 본다

정책:

- `blur`, `Enter`, 명시적 저장 등 기존 commit 시점에만 transaction이 발생하는 편집은 그 commit 1회를 undo 1회로 본다.
- keystroke마다 transaction을 발생시키는 방향으로 확장하지 않는다.
- 만약 현재 일부 편집 진입점이 keystroke 단위 transaction 구조라면, 이번 undo/redo 작업에서는 해당 경로를 commit 기반으로 먼저 정리한다.

이유:

- 텍스트 입력 중 `Cmd+Z` 우선순위와 캔버스 undo 우선순위를 명확히 나눌 수 있다.
- stack이 과도하게 잘게 쪼개지는 문제를 줄일 수 있다.
- `TableNode`, `Sidebar` 등 편집 진입점 간 UX를 통일할 수 있다.

## 범위 정의

### In Scope

1. 캔버스 직접 조작 undo/redo 인프라
2. `useCanvasStore`에 `undo`, `redo`, `canUndo`, `canRedo`, `stopHistoryCapture`
3. 단축키 등록
4. 툴바 또는 헤더에 undo/redo 버튼 노출
5. drag batching
6. 로컬/원격/system 변경 분리
7. 테스트 및 수동 검증 시나리오

### Out of Scope

1. 코드 에디터 undo/redo 통합
2. 저장 이력/버전 브라우징
3. 협업 세션 간 공유 history
4. 서버 API 변경
5. DB 스키마 변경

## 현재 구조 분석

### 상태 구조

- 원본 상태: `Y.Doc`
- 렌더 상태: `useCanvasStore.nodes`, `edges`, `groups`
- 동기화 경로:
  - 로컬 편집: store action → `ydoc.transact(...)`
  - 원격 편집: `Y.applyUpdate(..., 'remote')`
  - 렌더 갱신: `observeDeep` → Zustand projection

관련 파일:

- `client/src/stores/useCanvasStore.ts`
- `client/src/stores/canvas/canvasSyncActions.ts`
- `client/src/stores/canvas/canvasTableActions.ts`
- `client/src/stores/canvas/canvasGroupActions.ts`
- `client/src/hooks/useYjsCollaboration.ts`
- `client/src/collaboration/YjsProvider.ts`

### undo 적용에 유리한 점

1. 원격 반영이 이미 `origin='remote'`로 분리되어 있다.
2. 대부분의 사용자 조작이 store action 하나를 통해 Yjs transaction으로 들어간다.
3. 드래그 큐와 preview 모드 등 기존 경계가 이미 코드에 존재한다.

### undo 적용 시 주의할 점

1. 일부 action은 transaction origin이 없어 분류가 불가능하다.
2. 노드 드래그는 다수 이벤트로 들어오므로 batching이 필요하다.
3. preview/fallback은 `remote` origin 또는 system origin으로 stack 제외를 보장해야 한다.
4. `onNodesChange`는 React Flow 이벤트이므로 drag 종료 시점 경계 처리가 중요하다.
5. 현재 position flush에는 observer skip을 위한 `local-position-sync` origin 최적화가 있다.
   history origin 도입 시 이 최적화를 깨지 않도록 별도 정합성 설계가 필요하다.

## 상세 설계

### 1. 히스토리 전용 상수/타입 추가

신규 파일:

- `client/src/constants/canvas-history.ts`

포함 내용:

- `CANVAS_HISTORY_ORIGIN`
- `DRAG_TRANSACTION_ORIGIN`
- `UNDO_CAPTURE_TIMEOUT_MS`
- `isTextInputLikeTarget(eventTarget)` 유틸 또는 별도 util로 분리할 후보 정의

예시:

```typescript
export const CANVAS_HISTORY_ORIGIN = {
  USER_TABLE: 'canvas-user-table',
  USER_COLUMN: 'canvas-user-column',
  USER_EDGE: 'canvas-user-edge',
  USER_GROUP: 'canvas-user-group',
  USER_LAYOUT: 'canvas-user-layout',
  SYSTEM_PREVIEW: 'canvas-system-preview',
  SYSTEM_FALLBACK: 'canvas-system-fallback',
  SYSTEM_CODE_SYNC: 'canvas-system-code-sync',
  SYSTEM_DDL_IMPORT: 'canvas-system-ddl-import',
} as const;

export const DRAG_TRANSACTION_ORIGIN = { type: 'canvas-user-drag' } as const;
```

### 2. store 내부에 UndoManager 보관

`CanvasState` 확장:

- `history:`
  - `undoManager: Y.UndoManager | null`
  - `canUndo: boolean`
  - `canRedo: boolean`

또는 렌더 최적화를 위해 `internal.history` + 공개 selector 상태를 분리한다.

권장 구조:

- `internal.undoManager: Y.UndoManager | null`
- 공개 상태:
  - `canUndo: boolean`
  - `canRedo: boolean`

이유:

- `UndoManager` 객체 참조 자체는 렌더링 상태가 아니다.
- 버튼 활성화 여부만 리렌더링되면 충분하다.

### 3. UndoManager 생성/해제 위치

생성 시점:

- `initYDoc(ydoc)` 내부

대상 scope:

- `getTablesMap(ydoc)`
- `getEdgesMap(ydoc)`
- `getGroupsMap(ydoc)`

옵션:

- `trackedOrigins: new Set(USER_* origin + DRAG_TRANSACTION_ORIGIN)`
- `captureTimeout: 500`

이벤트 연동:

- `stack-item-added`
- `stack-item-popped`
- `stack-cleared`

이 이벤트에서 `canUndo`, `canRedo`를 동기화한다.

추가 규칙:

- `undo()` 또는 `redo()` 이후 새 사용자 변경이 발생하면 redo stack은 폐기되어야 한다.
- 이 동작은 `UndoManager` 기본 계약을 전제로 하되, `canRedo` 상태 동기화 테스트로 검증한다.

해제 시점:

- `destroyYDoc()` 내부에서 observer와 함께 정리

### 4. store 공개 API 추가

`CanvasState`에 다음을 추가한다.

- `canUndo: boolean`
- `canRedo: boolean`
- `undo: () => void`
- `redo: () => void`
- `stopHistoryCapture: () => void`

동작 규칙:

- `undo()` / `redo()`는 `undoManager`가 없으면 no-op
- 실행 직후 `activeEditNodeId`, highlight 상태를 안전하게 정리
- `stopHistoryCapture()`는 drag 종료, 명시적 commit 경계에서 호출

내부 구현 메모:

- history clear는 외부 공개 API로 노출하지 않는다.
- 다이어그램 전환/초기화 시점 정리는 `destroyYDoc()` 내부 책임으로 유지한다.

### 5. transaction origin 정리

#### 5.1 포함 대상 action

`canvasTableActions.ts`

- `addTable` → `USER_TABLE`
- `deleteTable` → `USER_TABLE`
- `renameTable` → `USER_TABLE`
- `updateTableMeta` → `USER_TABLE`
- `addColumn` → `USER_COLUMN`
- `deleteColumn` → `USER_COLUMN`
- `updateColumn` → `USER_COLUMN`
- `moveColumn` → `USER_COLUMN`
- `addFkRelation` → `USER_EDGE`
- `connectWithRelationType` → `USER_EDGE`
- `applyLayout` → `USER_LAYOUT`
- `removeEdge` / `removeEdgeWithFkColumn` → `USER_EDGE`

`canvasGroupActions.ts`

- 그룹 관련 전부 → `USER_GROUP`

#### 5.2 제외 대상 action

- `loadPreview` 자체는 Zustand direct set이므로 stack 영향 없음
- `useYjsCollaboration` fallback hydration은 `remote` 유지 또는 `SYSTEM_FALLBACK`
- `migrateJsonToYDoc`를 직접 transact로 감쌀 때도 trackedOrigins에서 제외
- `importDdl`, `replaceFromDdl`, `applyDiffPlan`은 `SYSTEM_*` origin으로 명시해 stack 제외

### 6. drag batching 설계

현재 구조:

- `onNodesChange`에서 position 변경이 다수 들어옴
- `tablePositionQueue`에 누적 후 drag 종료 시 Y.Doc flush

이 구조를 history와 결합한다.

주의:

- 현재 `canvasSyncActions.ts`의 `tablesObserver`는 transaction origin이 `local-position-sync`일 때 projection 재동기화를 생략한다.
- 단순히 drag flush origin을 `USER_DRAG`로 교체하면 이 최적화가 깨질 수 있다.

1차 권장 구현:

1. observer skip 목적 origin과 history 목적 origin을 분리하지 않는다.
2. drag flush transaction은 drag 전용 shared origin token을 사용한다.
3. `UndoManager.trackedOrigins`와 `tablesObserver` skip 조건이 동일한 drag origin token을 공유하도록 정리한다.
4. 즉 “skip 가능 + history 추적 가능”한 단일 drag origin 계약으로 맞춘다.

예시 방향:

```text
const DRAG_TRANSACTION_ORIGIN = { type: 'canvas-user-drag' };
```

정책:

1. drag 중간 프레임은 UI 상태만 갱신
2. drag 종료 시 flush transaction에 drag 전용 origin token 부여
3. drag 종료 직후 `stopHistoryCapture()` 호출로 다음 작업과 stack 분리

효과:

- 노드 한 번 이동 = undo 1회
- 여러 노드를 동시에 이동해도 drag session 기준으로 1회

### 7. rename / inline edit batching

문제:

- 입력 중 매 keystroke마다 transaction이 발생하면 undo가 너무 잘게 쪼개진다.

1차 대응 원칙:

- rename / inline edit는 commit 단위 undo로 고정한다.
- 현재 실제 저장 시점이 blur/submit commit이면 그 시점에만 transaction 수행한다.
- 만약 일부 편집 경로가 keystroke 단위 transaction이면, undo/redo 구현 전에 commit 방식으로 선정리한다.

구현 판단 기준:

- `TableNode`, `SidebarTableItem` 등 모든 이름 편집 경로는 동일 정책을 따른다.
- `captureTimeout`은 보조 장치일 뿐, keystroke batching 의존 설계는 1차에서 채택하지 않는다.

### 8. 단축키 설계

수정 파일:

- `client/src/constants/keybindings.ts`
- `client/src/pages/diagram/DiagramPage.tsx` 또는 `client/src/components/erd/ERDCanvas.tsx`

추가 단축키:

- `UNDO: 'mod+z'`
- `REDO: 'mod+shift+z, ctrl+y'`

가드 조건:

- `isPreviewMode === false`
- canvas 편집 가능 상태
- 포커스 대상이 텍스트 입력 컴포넌트가 아닐 것

예외:

- `input`, `textarea`, `[contenteditable="true"]`
- Monaco 편집기 내부 DOM

즉, 코드 에디터에서 `Cmd+Z`는 기존 Monaco undo가 동작해야 한다.

### 9. UI 노출

1차 권장 위치:

- `CanvasToolbar`에 Undo / Redo 버튼 추가

이유:

- 캔버스 조작 기능과 같은 맥락
- save / auto layout / FK connect와 함께 배치 가능

버튼 정책:

- `canUndo === false`면 disabled
- `canRedo === false`면 disabled
- preview mode 또는 readonly 상태면 disabled
- 아이콘 전용 버튼이면 `aria-label` 필수

### 10. autosave / collaboration 영향

#### autosave

- undo/redo는 결국 로컬 Y.Doc 변경이므로 autosave 대상이 된다.
- 이는 의도된 동작이다.
- 단, `undo()` 직후 autosave가 정상 작동하는지 확인 필요

#### collaboration

- 로컬 사용자의 undo는 새 Yjs update로 브로드캐스트된다.
- 즉 다른 참가자에게는 “새 편집 결과”로 보인다.
- 이것은 collaborative editor의 일반적인 동작이다.

정책:

- 공동 undo가 아니라 “내가 만든 로컬 변경을 되돌리는 새 협업 변경”으로 본다.
- 원격 변경 수신 후에도 stack은 유지한다.
- 다만 undo 결과가 현재 최신 remote 상태 일부를 다시 바꾸는 효과를 낼 수 있음을 구현/QA/문서에서 동일하게 인지한다.
- 1차에서는 remote 수신 시 history clear 정책을 사용하지 않는다.

#### preview / fallback

- preview는 Zustand direct set이라 undo stack에 들어가면 안 된다.
- fallback hydration은 현재 `origin='remote'` 경로를 유지해 stack 제외를 보장한다.

## 구현 단계

### Phase 1. 인프라

1. `canvas-history.ts` 추가
2. `CanvasState`에 history API 추가
3. `initYDoc` / `destroyYDoc`에 `UndoManager` 생성/정리 추가
4. `canUndo`, `canRedo` 상태 동기화 추가

### Phase 2. origin 정리

1. table/group/sync action의 모든 `ydoc.transact` 호출에 origin 부여
2. system action은 `SYSTEM_*` 또는 `remote` 유지
3. 직접 편집 action만 `trackedOrigins`에 포함

### Phase 3. drag batching

1. drag 종료 flush에 drag 전용 origin token 부여
2. drag 종료 후 `stopHistoryCapture()` 호출
3. observer skip 최적화와 history 추적이 동시에 유지되는지 검증
4. position-only undo 동작 검증

### Phase 4. 단축키/UI

1. keybinding 추가
2. 텍스트 편집 포커스 가드 추가
3. `CanvasToolbar` undo/redo 버튼 추가

### Phase 5. 검증/보완

1. 단위 테스트
2. 수동 협업 시나리오 검증
3. preview/fallback 회귀 확인

## 수정 대상 파일

### 필수

- `client/src/constants/keybindings.ts`
- `client/src/constants/canvas-history.ts` (신규)
- `client/src/stores/canvas/canvasStoreTypes.ts`
- `client/src/stores/useCanvasStore.ts`
- `client/src/stores/canvas/canvasSyncActions.ts`
- `client/src/stores/canvas/canvasTableActions.ts`
- `client/src/stores/canvas/canvasGroupActions.ts`
- `client/src/components/erd/CanvasToolbar.tsx`
- `client/src/pages/diagram/DiagramPage.tsx` 또는 `client/src/components/erd/ERDCanvas.tsx`

### 검토 필요

- `client/src/components/erd/TableNode.tsx`
- `client/src/components/layout/SidebarTableItem.tsx`
- `client/src/components/layout/Sidebar.tsx`
- `client/src/hooks/useYjsCollaboration.ts`

## 테스트 계획

### 단위 테스트

1. 테이블 추가 후 undo → 테이블 제거
2. 테이블 삭제 후 undo → 테이블 복구 + 관련 edge/group 참조 복구
3. 컬럼 이름 변경 후 undo/redo
4. FK 연결 후 undo/redo
5. 그룹 테이블 소속 변경 후 undo/redo
6. 자동 배치 후 undo/redo
7. drag 1회가 undo 1회로 동작
8. remote update는 `canUndo`를 증가시키지 않음
9. preview load는 `canUndo`를 증가시키지 않음
10. undo 직후 새 사용자 변경 발생 시 `redo` stack이 비워짐
11. drag flush origin이 observer skip 최적화를 깨지 않음

### 수동 검증

1. 캔버스 빈 영역 포커스 상태에서 `Cmd+Z` / `Cmd+Shift+Z`
2. 테이블 인라인 이름 편집 중 `Cmd+Z`는 입력값만 되돌림
3. Monaco 편집기에서 `Cmd+Z`는 코드 undo만 수행
4. 두 브라우저 협업 중 A 사용자의 로컬 변경만 A에서 undo 가능
5. undo 직후 autosave/save 후 새로고침 시 결과 유지
6. preview mode에서는 undo 버튼 disabled

### 회귀 검증

1. API preview → live handoff 기존 동작 유지
2. remote lock / sync status / toolbar 조건부 렌더 유지
3. 노드 드래그 중 깜빡임 또는 위치 sync 누락 없음
4. remote 변경 수신 후 undo 실행 시 앱 상태가 깨지지 않고, 결과가 협업 변경으로 정상 전파됨

## 리스크 및 대응

### 리스크 1. origin 누락으로 system 변경이 undo stack에 섞임

대응:

- `rg "transact\\("` 기준 전수 점검
- `USER_*`와 `SYSTEM_*` 분류표 기준으로 코드 리뷰

### 리스크 2. drag가 과도하게 많은 stack item을 생성

대응:

- queue flush 시점만 history 기록
- drag 종료 후 `stopHistoryCapture()`

### 리스크 3. 텍스트 입력과 캔버스 단축키 충돌

대응:

- 포커스 target 가드 함수 도입
- Monaco DOM 예외 처리 추가

### 리스크 4. 협업 중 undo가 원격 변경을 덮어쓰는 것처럼 보일 수 있음

대응:

- 1차 정책을 “공동 undo”가 아니라 “로컬 변경을 상쇄하는 새 협업 변경”으로 명확히 정의
- remote 자체는 stack에 넣지 않음
- remote 수신 후 stack은 유지하되, conflict-aware UX는 2차 과제로 분리

### 리스크 5. drag origin 변경으로 observer 최적화가 깨질 수 있음

대응:

- drag 전용 origin token을 단일 계약으로 도입
- `tablesObserver` skip 조건과 `UndoManager.trackedOrigins`가 같은 token을 사용하도록 정리
- position drag 단위 테스트로 중복 projection/깜빡임 여부 확인

### 리스크 6. 대량 변경 기능까지 섞이면 회귀 범위가 커짐

대응:

- `applyDiffPlan`, `importDdl`, `replaceFromDdl`는 1차에서 stack 제외
- 추후 2차 작업으로 별도 설계

## 완료 기준 (DoD)

1. 캔버스 직접 조작에 대해 undo/redo가 동작한다.
2. 원격 변경/preview/fallback/init 경로는 undo stack에 들어가지 않는다.
3. 텍스트 입력 중 `Cmd+Z`가 캔버스 undo를 가로채지 않는다.
4. drag 1회가 undo 1회로 동작한다.
5. toolbar에서 undo/redo 상태가 올바르게 표시된다.
6. undo 후 새 작업 발생 시 redo stack 폐기 계약이 검증된다.
7. drag origin 변경 후 observer 최적화가 유지된다.
8. 최소 단위 테스트와 핵심 수동 시나리오 검증이 완료된다.

## 향후 2차 확장 후보

1. DDL Import / Replace를 “1회 대량 작업”으로 history에 편입
2. Code → ERD apply 결과를 별도 system history lane으로 관리
3. 사용자가 변경 요약을 보고 특정 step으로 점프하는 history panel
4. 협업 중 conflict-aware undo UX 개선

## 요약

이번 undo/redo는 React Flow snapshot 방식이 아니라, 현재 협업 아키텍처에 맞춰
`Y.UndoManager + origin 분리 + drag batching`으로 구현한다.

1차 범위는 “ERD 캔버스 직접 조작만 안전하게 되돌리기”로 제한한다.
이 범위라면 기존 preview/handoff/autosave/협업 구조를 깨지 않고 실사용성이 높은 복구 기능을 제공할 수 있다.
