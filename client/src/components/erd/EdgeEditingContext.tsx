import { createContext, useContext } from 'react';
import type { RemoteEditLockInfo } from '@/lib/remote-edit-locks';
import type { EdgeWaypointPreview } from '@/types/collaboration';
import type { LocalEdgeWaypointDrag, LocalEdgeWaypointDragKind } from '@/stores/erd/useCollaborationStore';
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

const EMPTY_LOCKS = new Map<string, RemoteEditLockInfo>();
const EMPTY_PREVIEWS = new Map<string, EdgeWaypointPreview>();

const EdgeEditingContext = createContext<EdgeEditingContextValue>({
  edgeLocksById: EMPTY_LOCKS,
  edgePreviewsById: EMPTY_PREVIEWS,
  localEdgeDrag: null,
  beginSegmentDrag: () => {},
  splitSegment: () => {},
});

export function EdgeEditingProvider({
  value,
  children,
}: {
  value: EdgeEditingContextValue;
  children: React.ReactNode;
}) {
  return <EdgeEditingContext.Provider value={value}>{children}</EdgeEditingContext.Provider>;
}

export function useEdgeEditingContext(): EdgeEditingContextValue {
  return useContext(EdgeEditingContext);
}
