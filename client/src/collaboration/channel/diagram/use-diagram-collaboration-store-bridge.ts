import { useMemo } from 'react';
import type { ProjectionRefreshRequest } from '@/collaboration/core/contracts/document-plugin';
import { parseErdColumnEntityId } from '@/collaboration/plugins/erd/erd-column-entity-id';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';

function collectProjectionTargets(request?: ProjectionRefreshRequest): Set<'nodes' | 'edges' | 'groups'> {
  const targets = new Set<'nodes' | 'edges' | 'groups'>(request?.targets ?? []);
  if ((request?.nodeIds?.length ?? 0) > 0) {
    targets.add('nodes');
  }
  if ((request?.edgeIds?.length ?? 0) > 0) {
    targets.add('edges');
  }
  if ((request?.groupIds?.length ?? 0) > 0) {
    targets.add('groups');
  }
  return targets;
}

/**
 * 다이어그램 채널의 canvas/collaboration store 액션을 하나의 bridge로 묶는다.
 */
export function useDiagramCollaborationStoreBridge(): DiagramCollaborationStoreBridge {
  const loadPreview = useCanvasStore((s) => s.loadPreview);
  const syncFromYDoc = useCanvasStore((s) => s.syncFromYDoc);
  const applyPreviewPositionChangesToPersisted = useCanvasStore(
    (state) => state.applyPreviewPositionChangesToPersisted,
  );
  const setConnectionStatus = useCollaborationStore((s) => s.setConnectionStatus);
  const setPresenceMode = useCollaborationStore((s) => s.setPresenceMode);
  const setSelfUserId = useCollaborationStore((s) => s.setSelfUserId);
  const applyPresenceSnapshot = useCollaborationStore((s) => s.applyPresenceSnapshot);
  const applyPeerJoined = useCollaborationStore((s) => s.applyPeerJoined);
  const applyPeerLeft = useCollaborationStore((s) => s.applyPeerLeft);
  const updateAwareness = useCollaborationStore((s) => s.updateAwareness);
  const removePeerByUserId = useCollaborationStore((s) => s.removePeerByUserId);
  const removePeerByLoginId = useCollaborationStore((s) => s.removePeerByLoginId);
  const applyDocumentChange = useCollaborationStore((s) => s.applyDocumentChange);
  const resetCollaboration = useCollaborationStore((s) => s.reset);

  return useMemo(
    () => ({
      loadPreview,
      applyPreviewPositionChangesToPersisted,
      refreshPersistedCanvasFromYDoc: (request?: ProjectionRefreshRequest) => {
        if (request?.forceFull) {
          syncFromYDoc({ forceFull: true });
          return;
        }

        const targets = collectProjectionTargets(request);
        const nodeIds = new Set<string>(request?.nodeIds ?? []);
        const edgeIds = new Set<string>(request?.edgeIds ?? []);
        const groupIds = new Set<string>(request?.groupIds ?? []);

        if (request?.scopeHints?.length) {
          for (const scope of request.scopeHints) {
            if (scope.kind === 'table') {
              targets.add('nodes');
              nodeIds.add(scope.id);
              continue;
            }
            if (scope.kind === 'column') {
              const columnRef = parseErdColumnEntityId(scope.id);
              if (!columnRef) {
                syncFromYDoc({ forceFull: true });
                return;
              }
              targets.add('nodes');
              nodeIds.add(columnRef.tableId);
              continue;
            }
            if (scope.kind === 'edge') {
              targets.add('edges');
              edgeIds.add(scope.id);
              continue;
            }
            if (scope.kind === 'group') {
              targets.add('groups');
              groupIds.add(scope.id);
              continue;
            }
            syncFromYDoc({ forceFull: true });
            return;
          }
        }

        if (targets.size === 0) {
          syncFromYDoc({ forceFull: true });
          return;
        }

        const nextRequest = {
          targets: [...targets],
          nodeIds: [...nodeIds],
          edgeIds: [...edgeIds],
          groupIds: [...groupIds],
        };
        syncFromYDoc(nextRequest);
      },
      setConnectionStatus,
      setPresenceMode,
      setSelfUserId,
      applyPresenceSnapshot,
      applyPeerJoined,
      applyPeerLeft,
      updateAwareness,
      removePeerByUserId,
      removePeerByLoginId,
      applyDocumentChange,
      resetCollaboration,
    }),
    [
      applyDocumentChange,
      applyPeerJoined,
      applyPeerLeft,
      applyPresenceSnapshot,
      loadPreview,
      applyPreviewPositionChangesToPersisted,
      removePeerByLoginId,
      removePeerByUserId,
      resetCollaboration,
      setConnectionStatus,
      setPresenceMode,
      setSelfUserId,
      syncFromYDoc,
      updateAwareness,
    ],
  );
}
