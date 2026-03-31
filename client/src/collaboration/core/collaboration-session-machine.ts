import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from './collaboration-runtime-types.js';
import { INITIAL_COLLABORATION_RUNTIME_STATE } from './collaboration-runtime-types.js';

/**
 * 협업 런타임 상태 머신 전이 함수.
 *
 * <p>1차에서는 현재 구현의 의미를 공통 pure function으로 고정하는 것이 목적이며,
 * 실제 hook wiring은 이후 단계에서 이 전이 함수를 사용하도록 이동한다.</p>
 *
 * @param currentState 현재 런타임 상태
 * @param event        상태 전이 이벤트
 * @returns 다음 런타임 상태
 */
export function transitionCollaborationRuntimeState(
  currentState: CollaborationRuntimeState,
  event: CollaborationRuntimeEvent,
): CollaborationRuntimeState {
  switch (event) {
    case 'destroy':
      return INITIAL_COLLABORATION_RUNTIME_STATE;
    case 'bootstrap-loaded':
      return 'preview';
    case 'ws-connected':
      return currentState === 'preview' ? 'hydrating' : currentState;
    case 'remote-snapshot-applied':
      return 'live';
    case 'fallback-timeout':
    case 'setup-failed':
      return 'degraded';
    case 'disconnect':
      return 'degraded';
    case 'reconnect-start':
      return 'reconnecting';
    default:
      return currentState;
  }
}
