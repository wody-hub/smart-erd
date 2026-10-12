# Local Projection Flush Fix Plan

- Date: 2026-10-12
- Bug: 로컬 모드에서 DDL Import(및 모든 `canvas-system-*` 쓰기) 후 캔버스에 반영 안 됨. ydoc에는 저장되고 새로고침하면 나타남.
- Root cause: `canvas-system-*` origin 트랜잭션은 projection을 projector에게 위임(defer)하는데 (`canvasSyncActions.ts:400-407`, `document-change-origin.ts:19-23`), 로컬 모드엔 projector가 없어 flush가 발생하지 않음. 팀 모드는 projector/`onNodesChange`/`finalizeNodeDrag` 경로로 flush됨.

## Task 1: 스토어에 flush 액션 노출 (공용, 동작 불변)

**Files:** `client/src/stores/canvas/canvasSyncActions.ts`, `client/src/stores/canvas/canvasStoreTypes.ts`

- `CanvasSyncActionKeys`에 `'flushDeferredProjection'` 추가.
- return 객체에 추가 (기존 `flushDeferredProjectionSync` 클로저 그대로 노출):

```ts
    /**
     * 지연된 projection을 즉시 반영한다.
     *
     * projector 없이 동작하는 로컬 모드에서 `canvas-system-*` 트랜잭션 후 호출한다.
     * 대기 큐가 비었으면 아무 일도 하지 않는다.
     */
    flushDeferredProjection: () => {
      flushDeferredProjectionSync();
    },
```

- `CanvasState` 타입에 추가 (`serialize` 옆):

```ts
  /** 지연된 projection을 즉시 반영한다 (대기 없으면 no-op). */
  flushDeferredProjection: () => void;
```

- 검증: `npx tsc --noEmit` exit 0. 기존 호출부 untouched이므로 팀 모드 동작 불변.

## Task 2: 로컬 훅에서 ydoc update 시 flush 구독

**Files:** `client/src/pages/erd-local/useErdLocalPersistence.ts`

- mount effect에 추가 (doc 생성 직후):

```ts
    /** 지연 projection flush 타이머 */
    let flushTimer: number | undefined;
    /** ydoc 변경 시 지연 projection을 반영한다. @returns 없음 */
    const handleDocUpdate = () => {
      if (!useCanvasStore.getState().internal.hasDeferredProjectionSync) {
        return;
      }
      window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => {
        useCanvasStore.getState().flushDeferredProjection();
      }, 50);
    };
    doc.on('update', handleDocUpdate);
```

- cleanup에 추가: `window.clearTimeout(flushTimer); doc.off('update', handleDocUpdate);` (기존 `doc.destroy()` 전에).
- 50ms debounce 사유: multi-transact 흐름 일괄 처리. 일반 로컬 편집(origin local)은 defer 큐에 안 쌓이므로 flush no-op으로 스킵됨. 드래그 중에는 DRAG origin 경로가 우선이라 간섭 없음.
- 검증: `npx tsc --noEmit` exit 0, `npx eslint src/pages/erd-local/ src/stores/canvas/` 에러 없음.

## Task 3: 검증

- `npm run test:unit -- erd-local-storage` PASS (회귀).
- 브라우저: dev 서버 → `/erd-local` → DDL Import → **새로고침 없이** 테이블 렌더 확인 → 콘솔 에러 확인 → 네트워크 `/api/` 0건 유지.
- 팀 모드 회귀는 기존 E2E smoke 범위 (변경이 additive라 생략 가능, 판단은 리뷰에).
