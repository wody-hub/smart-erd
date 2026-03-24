import { useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import { useCollaborationSession } from '@/collaboration/core/use-collaboration-session';
import {
  toPreviewSyncStatus,
  type PreviewSyncStatus,
} from '@/collaboration/core/collaboration-preview-sync-status';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { DiagramDetail } from '@/types/diagram';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import { DiagramCollaborationPreviewPolicy } from './diagram-collaboration-preview-policy.js';
import { DiagramCollaborationProviderLifecycle } from './diagram-collaboration-provider-lifecycle.js';
import { useDiagramCollaborationStoreBridge } from './use-diagram-collaboration-store-bridge.js';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';
import { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';

/** WS 스냅샷이 도착하지 않을 때 JSON content로 폴백하기까지의 대기 시간 (ms) */
const WS_SNAPSHOT_FALLBACK_MS = 5_000;

export interface CreateDiagramCollaborationProviderLifecycleArgs {
  ydoc: Y.Doc;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  updatePreviewMode: (next: boolean) => void;
  onProviderReady: Parameters<
    ConstructorParameters<typeof DiagramCollaborationProviderLifecycle>[0]['onProviderReady']
  >[0] extends never
    ? never
    : ConstructorParameters<typeof DiagramCollaborationProviderLifecycle>[0]['onProviderReady'];
  onProviderDisposed: () => void;
}

export type CreateDiagramCollaborationProviderLifecycle = (
  args: CreateDiagramCollaborationProviderLifecycleArgs,
) => DiagramCollaborationProviderLifecycle;

interface UseDiagramCollaborationRuntimeReturn {
  collaborationBootstrap: DiagramCollaborationBootstrap | null;
  previewSyncStatus: PreviewSyncStatus;
  initYDoc: (doc: Y.Doc) => void;
  destroyYDoc: () => void;
  storeBridge: DiagramCollaborationStoreBridge;
  resetRuntimeState: () => void;
  createProviderLifecycle: CreateDiagramCollaborationProviderLifecycle;
}

/**
 * 다이어그램 채널의 collaboration runtime 상태와 store binding을 조립한다.
 */
export function useDiagramCollaborationRuntime(
  diagram: DiagramDetail | undefined,
): UseDiagramCollaborationRuntimeReturn {
  const initYDoc = useCanvasStore((s) => s.initYDoc);
  const destroyYDoc = useCanvasStore((s) => s.destroyYDoc);
  const storeBridge = useDiagramCollaborationStoreBridge();

  const previewPolicy = useMemo(
    () => new DiagramCollaborationPreviewPolicy(),
    [],
  );
  const documentAdapter = useMemo(
    () => new DiagramYjsDocumentAdapter(),
    [],
  );
  const runtimeTransition = useMemo(
    () => previewPolicy.transition.bind(previewPolicy),
    [previewPolicy],
  );
  const collaborationBootstrap = useMemo<DiagramCollaborationBootstrap | null>(
    () => {
      if (!diagram) {
        return null;
      }
      return {
        content: diagram.content,
        hasYdocSnapshot: diagram.hasYdocSnapshot,
        contentRevision: diagram.contentRevision,
      };
    },
    [diagram?.content, diagram?.contentRevision, diagram?.hasYdocSnapshot],
  );
  const { runtimeState, dispatchRuntimeEvent, resetRuntimeState } = useCollaborationSession({
    transition: runtimeTransition,
  });
  const previewEnabled = Boolean(
    collaborationBootstrap && previewPolicy.shouldStartInPreview(collaborationBootstrap),
  );
  const previewSyncStatus = toPreviewSyncStatus(runtimeState, previewEnabled);

  const createProviderLifecycle = useCallback(
    ({
      ydoc,
      diagramId,
      teamId,
      projectId,
      updatePreviewMode,
      onProviderReady,
      onProviderDisposed,
    }: CreateDiagramCollaborationProviderLifecycleArgs) => {
      const handoffStartedAt = performance.now();
      const handoffLogPrefix = `[useYjsCollaboration][diagramId=${diagramId}]`;
      return new DiagramCollaborationProviderLifecycle({
        ydoc,
        bootstrap: collaborationBootstrap!,
        diagramId,
        teamId,
        projectId,
        previewEnabled,
        fallbackTimeoutMs: WS_SNAPSHOT_FALLBACK_MS,
        handoffStartedAt,
        handoffLogPrefix,
        documentAdapter,
        dispatchRuntimeEvent,
        updatePreviewMode,
        storeBridge,
        onProviderReady,
        onProviderDisposed,
      });
    },
    [
      collaborationBootstrap,
      dispatchRuntimeEvent,
      documentAdapter,
      previewEnabled,
      storeBridge,
    ],
  );

  return {
    collaborationBootstrap,
    previewSyncStatus,
    initYDoc,
    destroyYDoc,
    storeBridge,
    resetRuntimeState,
    createProviderLifecycle,
  };
}
