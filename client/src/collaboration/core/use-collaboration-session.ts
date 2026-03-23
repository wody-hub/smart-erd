import { useRef } from 'react';
import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from './collaboration-runtime-types.js';
import { INITIAL_COLLABORATION_RUNTIME_STATE } from './collaboration-runtime-types.js';
import { transitionCollaborationRuntimeState } from './collaboration-session-machine.js';

/**
 * 공통 협업 런타임 상태 머신을 React state에 연결하는 얇은 훅.
 *
 * <p>1차에서는 기존 useYjsCollaboration 내부 의미를 바꾸지 않고,
 * preview/hydrating/live/degraded/reconnecting 상태 전이만 공통 훅으로 고정한다.</p>
 */
export function useCollaborationSession() {
  const runtimeStateRef = useRef<CollaborationRuntimeState>(INITIAL_COLLABORATION_RUNTIME_STATE);

  const dispatchRuntimeEvent = (event: CollaborationRuntimeEvent) => {
    runtimeStateRef.current = transitionCollaborationRuntimeState(runtimeStateRef.current, event);
  };

  const resetRuntimeState = () => {
    runtimeStateRef.current = INITIAL_COLLABORATION_RUNTIME_STATE;
  };

  return {
    dispatchRuntimeEvent,
    resetRuntimeState,
  };
}
