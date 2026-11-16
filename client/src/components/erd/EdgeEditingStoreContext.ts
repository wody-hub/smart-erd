import { createContext, useContext } from 'react';
import { createKeyedStore, type KeyedStore } from '@/lib/keyed-external-store';
import { useKeyedStoreValue } from '@/hooks/useKeyedStoreValue';
import {
  areEdgeEditingStatesEqual,
  EMPTY_EDGE_EDITING_STATE,
  type EdgeEditingState,
} from './edgeEditingState';
import type { BeginSegmentDragParams, SplitSegmentParams } from './EdgeEditingContext';

/** Provider 수명 동안 참조를 유지하는 엣지 구독 계약. */
interface EdgeEditingSubscription {
  store: KeyedStore<EdgeEditingState>;
  beginSegmentDrag: (params: BeginSegmentDragParams) => void;
  splitSegment: (params: SplitSegmentParams) => void;
}

export const EdgeEditingStoreContext = createContext<EdgeEditingSubscription>({
  store: createKeyedStore(new Map(), areEdgeEditingStatesEqual),
  beginSegmentDrag: () => {},
  splitSegment: () => {},
});

/**
 * 자기 엣지의 잠금, 프리뷰, 로컬 드래그만 구독한다.
 * @param edgeId 구독할 엣지 ID
 * @returns 해당 엣지 상태와 안정적인 편집 동작
 */
export function useEdgeEditing(
  edgeId: string,
): EdgeEditingState & Omit<EdgeEditingSubscription, 'store'> {
  const { store, beginSegmentDrag, splitSegment } = useContext(EdgeEditingStoreContext);
  const state = useKeyedStoreValue(store, edgeId) ?? EMPTY_EDGE_EDITING_STATE;
  return { ...state, beginSegmentDrag, splitSegment };
}
