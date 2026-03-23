import { useCallback, useState } from 'react';
import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from './collaboration-runtime-types.js';
import { INITIAL_COLLABORATION_RUNTIME_STATE } from './collaboration-runtime-types.js';
import { transitionCollaborationRuntimeState } from './collaboration-session-machine.js';

interface UseCollaborationSessionOptions {
  transition?: (
    currentState: CollaborationRuntimeState,
    event: CollaborationRuntimeEvent,
  ) => CollaborationRuntimeState;
}

/**
 * 공통 협업 런타임 상태 머신을 React state에 연결하는 얇은 훅.
 *
 * <p>1차에서는 기존 useYjsCollaboration 내부 의미를 바꾸지 않고,
 * preview/hydrating/live/degraded/reconnecting 상태 전이만 공통 훅으로 고정한다.</p>
 */
export function useCollaborationSession(options?: UseCollaborationSessionOptions) {
  const [runtimeState, setRuntimeState] = useState<CollaborationRuntimeState>(
    INITIAL_COLLABORATION_RUNTIME_STATE,
  );
  const transition = options?.transition ?? transitionCollaborationRuntimeState;

  const dispatchRuntimeEvent = useCallback((event: CollaborationRuntimeEvent) => {
    setRuntimeState((currentState) =>
      transition(currentState, event),
    );
  }, [transition]);

  const resetRuntimeState = useCallback(() => {
    setRuntimeState(INITIAL_COLLABORATION_RUNTIME_STATE);
  }, []);

  return {
    runtimeState,
    dispatchRuntimeEvent,
    resetRuntimeState,
  };
}
