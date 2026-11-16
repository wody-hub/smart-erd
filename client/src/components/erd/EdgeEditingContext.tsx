import { useLayoutEffect, useMemo, useState } from 'react';
import { createKeyedStore } from '@/lib/keyed-external-store';
import { useCommittedCallback } from '@/hooks/useCommittedCallback';
import { buildEdgeEditingStates, areEdgeEditingStatesEqual } from './edgeEditingState';
import { EdgeEditingStoreContext } from './EdgeEditingStoreContext';
import type { RemoteEditLockInfo } from '@/lib/remote-edit-locks';
import type { EdgeWaypointPreview } from '@/types/collaboration';
import type {
  LocalEdgeWaypointDrag,
  LocalEdgeWaypointDragKind,
} from '@/stores/erd/useCollaborationStore';
import type { Waypoint } from '@/types/erd';
import type { EdgePoint } from './edgeWaypointGeometry';

export interface BeginSegmentDragParams {
  edgeId: string;
  pointerId: number;
  segmentIndex: number;
  axis: 'x' | 'y';
  kind: LocalEdgeWaypointDragKind;
  routePoints: Waypoint[];
  waypoints: Waypoint[];
}

export interface SplitSegmentParams {
  edgeId: string;
  segmentIndex: number;
  routePoints: Waypoint[];
  clickPoint: EdgePoint;
}

interface EdgeEditingContextValue {
  edgeLocksById: Map<string, RemoteEditLockInfo>;
  edgePreviewsById: Map<string, EdgeWaypointPreview>;
  localEdgeDrag: LocalEdgeWaypointDrag | null;
  beginSegmentDrag: (params: BeginSegmentDragParams) => void;
  splitSegment: (params: SplitSegmentParams) => void;
}

/**
 * 엣지별 구독 스토어와 참조가 안정적인 편집 동작을 제공한다.
 * @param props 현재 편집 상태와 하위 요소
 * @returns 엣지 편집 Provider
 */
export function EdgeEditingProvider({
  value,
  children,
}: {
  value: EdgeEditingContextValue;
  children: React.ReactNode;
}) {
  const [store] = useState(() =>
    createKeyedStore(
      buildEdgeEditingStates(value.edgeLocksById, value.edgePreviewsById, value.localEdgeDrag),
      areEdgeEditingStatesEqual,
    ),
  );
  const beginSegmentDrag = useCommittedCallback(value.beginSegmentDrag);
  const splitSegment = useCommittedCallback(value.splitSegment);
  useLayoutEffect(() => {
    store.update(
      buildEdgeEditingStates(value.edgeLocksById, value.edgePreviewsById, value.localEdgeDrag),
    );
  }, [store, value.edgeLocksById, value.edgePreviewsById, value.localEdgeDrag]);
  const context = useMemo(
    () => ({ store, beginSegmentDrag, splitSegment }),
    [store, beginSegmentDrag, splitSegment],
  );
  return (
    <EdgeEditingStoreContext.Provider value={context}>{children}</EdgeEditingStoreContext.Provider>
  );
}
