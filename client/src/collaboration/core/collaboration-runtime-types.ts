/**
 * 프론트 협업 런타임의 1급 상태 정의.
 *
 * <p>기존 구현은 preview/fallback/live 의미가 여러 effect에 흩어져 있었기 때문에,
 * 1차에서는 우선 상태 이름과 이벤트를 공통 타입으로 고정한다.</p>
 */
export type CollaborationRuntimeState =
  | 'preview'
  | 'hydrating'
  | 'live'
  | 'degraded'
  | 'reconnecting';

/** 협업 런타임 상태 전이를 유발하는 이벤트 */
export type CollaborationRuntimeEvent =
  | 'bootstrap-loaded'
  | 'ws-connected'
  | 'remote-snapshot-applied'
  | 'fallback-timeout'
  | 'setup-failed'
  | 'disconnect'
  | 'reconnect-start'
  | 'destroy';

/** 협업 런타임 초기 상태 */
export const INITIAL_COLLABORATION_RUNTIME_STATE: CollaborationRuntimeState = 'preview';
