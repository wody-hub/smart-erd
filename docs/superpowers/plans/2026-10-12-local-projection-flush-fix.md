# Local Projection Sync Fix Plan

- Date: 2026-10-12
- Bug: 로컬 모드에서 DDL Import(및 모든 `canvas-system-*` 쓰기) 후 캔버스에 반영 안 됨. ydoc에는 저장되고 새로고침하면 나타남.
- Root cause: 옵저버가 `canvas-system-*` 트랜잭션을 projector가 처리한다고 보고 drop하는데 (`canvasSyncActions.ts` 옵저버의 `shouldDeferProjectionToProjector` early-return, `document-change-origin.ts:19-23`), 로컬 모드에는 projector가 없으므로 반영이 누락됨. 팀 모드는 projector/session 경로로 반영됨.
- Fix (확정, 검증됨): 공용 스토어 무변경. 로컬 훅에서 system-origin 변경만 골라 `syncFromYDoc()` 재동기화. (초안의 flush-노출안은 검증 중 폐기 — defer 큐가 아니라 drop이 원인이었음.)

## Task 1: 로컬 훅에서 system-origin 변경 재동기화 (erd-local only, 공용 무변경) ✅ done

**Files:** `client/src/pages/erd-local/useErdLocalPersistence.ts` (커밋 `f133170`)

- `isProjectorManagedDocumentOrigin` (type-only import라 런타임 의존 없음)을 이용해 `doc.on('update')`에서 system-origin만 골라 `syncFromYDoc()` 호출 (50ms debounce). 일반 로컬 편집은 옵저버가 처리하므로 스킵. 드래그 중이면 스토어가 내부 큐에 적재해 종료 시 반영하므로 hook 추가 처리 불필요.
- mount/import/reset의 doc 교체 지점마다 구독 부착·해제 (`unsubscribeSyncRef`).
- 검증: `npx tsc --noEmit` exit 0, `npx eslint src/pages/erd-local/` 에러 없음, `api/*` grep clean.

## Task 2: 검증 (브라우저) ✅ done 2026-10-12

- dev 서버 → `/erd-local` → DDL Import → 새로고침 없이 members+coupons 2노드 즉시 렌더, 콘솔 에러 없음.
