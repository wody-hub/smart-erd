import { useMemo } from 'react';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';

/**
 * 다이어그램 채널의 canvas/collaboration store 액션을 하나의 bridge로 묶는다.
 */
export function useDiagramCollaborationStoreBridge(): DiagramCollaborationStoreBridge {
  const loadPreview = useCanvasStore((s) => s.loadPreview);
  const setConnectionStatus = useCollaborationStore((s) => s.setConnectionStatus);
  const setPresenceMode = useCollaborationStore((s) => s.setPresenceMode);
  const setSelfUserId = useCollaborationStore((s) => s.setSelfUserId);
  const applyPresenceSnapshot = useCollaborationStore((s) => s.applyPresenceSnapshot);
  const applyPeerJoined = useCollaborationStore((s) => s.applyPeerJoined);
  const applyPeerLeft = useCollaborationStore((s) => s.applyPeerLeft);
  const updateAwareness = useCollaborationStore((s) => s.updateAwareness);
  const removePeerByUserId = useCollaborationStore((s) => s.removePeerByUserId);
  const removePeerByLoginId = useCollaborationStore((s) => s.removePeerByLoginId);
  const resetCollaboration = useCollaborationStore((s) => s.reset);

  return useMemo(
    () => ({
      loadPreview,
      setConnectionStatus,
      setPresenceMode,
      setSelfUserId,
      applyPresenceSnapshot,
      applyPeerJoined,
      applyPeerLeft,
      updateAwareness,
      removePeerByUserId,
      removePeerByLoginId,
      resetCollaboration,
    }),
    [
      applyPeerJoined,
      applyPeerLeft,
      applyPresenceSnapshot,
      loadPreview,
      removePeerByLoginId,
      removePeerByUserId,
      resetCollaboration,
      setConnectionStatus,
      setPresenceMode,
      setSelfUserId,
      updateAwareness,
    ],
  );
}
