import type { RemoteEditLockInfo } from '@/lib/remote-edit-locks';
import { areRemoteEditLocksEqual, areEdgeWaypointPreviewsEqual } from '@/lib/remote-edit-locks';
import type { EdgeWaypointPreview } from '@/types/collaboration';
import type { LocalEdgeWaypointDrag } from '@/stores/erd/useCollaborationStore';

/** 한 엣지에 영향을 주는 협업 편집 상태. */
export interface EdgeEditingState {
  edgeLock: RemoteEditLockInfo | null;
  edgePreview: EdgeWaypointPreview | null;
  localEdgeDrag: LocalEdgeWaypointDrag | null;
}

export const EMPTY_EDGE_EDITING_STATE: EdgeEditingState = {
  edgeLock: null,
  edgePreview: null,
  localEdgeDrag: null,
};

/**
 * 잠금, 프리뷰, 로컬 드래그를 대상 엣지 ID별 스냅샷으로 묶는다.
 * @param locks 잠금 맵
 * @param previews 프리뷰 맵
 * @param localDrag 현재 로컬 드래그
 * @returns 활성 상태가 있는 엣지만 포함하는 맵
 */
export function buildEdgeEditingStates(
  locks: Map<string, RemoteEditLockInfo>,
  previews: Map<string, EdgeWaypointPreview>,
  localDrag: LocalEdgeWaypointDrag | null,
): Map<string, EdgeEditingState> {
  const ids = new Set([...locks.keys(), ...previews.keys()]);
  if (localDrag) ids.add(localDrag.edgeId);
  return new Map(
    [...ids].map((id) => [
      id,
      {
        edgeLock: locks.get(id) ?? null,
        edgePreview: previews.get(id) ?? null,
        localEdgeDrag: localDrag?.edgeId === id ? localDrag : null,
      },
    ]),
  );
}

/**
 * 엣지 표시 상태를 비교해 다른 엣지의 변경을 걸러낸다.
 * @param left 이전 엣지 상태
 * @param right 새 엣지 상태
 * @returns 엣지에 보이는 상태가 같으면 true
 */
export function areEdgeEditingStatesEqual(
  left: EdgeEditingState,
  right: EdgeEditingState,
): boolean {
  return (
    left.localEdgeDrag === right.localEdgeDrag &&
    (left.edgeLock === right.edgeLock ||
      (!!left.edgeLock &&
        !!right.edgeLock &&
        areRemoteEditLocksEqual(left.edgeLock, right.edgeLock))) &&
    (left.edgePreview === right.edgePreview ||
      (!!left.edgePreview &&
        !!right.edgePreview &&
        areEdgeWaypointPreviewsEqual(left.edgePreview, right.edgePreview)))
  );
}
