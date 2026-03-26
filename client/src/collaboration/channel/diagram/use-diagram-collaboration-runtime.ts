import { useCallback } from 'react';
import * as Y from 'yjs';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import { useCollaborationSession } from '@/collaboration/core/use-collaboration-session';
import type { DocumentBootstrapPayload } from '@/collaboration/core/contracts/document-bootstrap';
import type { DocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import {
  toPreviewSyncStatus,
  type PreviewSyncStatus,
} from '@/collaboration/core/collaboration-preview-sync-status';
import { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { DiagramDetail } from '@/types/diagram';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import { useDiagramCollaborationStoreBridge } from './use-diagram-collaboration-store-bridge.js';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';
import { createDiagramCollaborationProviderLifecycle } from './create-diagram-collaboration-provider-lifecycle.js';
import type {
  CreateDiagramCollaborationProviderLifecycle,
  DiagramCollaborationProviderLifecycleFactoryArgs as CreateDiagramCollaborationProviderLifecycleArgs,
} from './diagram-collaboration-provider-factory.js';
import { useDiagramRuntimeBootstrap } from './use-diagram-runtime-bootstrap.js';
import { useDiagramDocumentRuntime } from './use-diagram-document-runtime.js';

/** WS 스냅샷이 도착하지 않을 때 JSON content로 폴백하기까지의 대기 시간 (ms) */
const WS_SNAPSHOT_FALLBACK_MS = 5_000;

export type { CreateDiagramCollaborationProviderLifecycle };

interface UseDiagramCollaborationRuntimeReturn {
  collaborationBootstrap: DiagramCollaborationBootstrap | null;
  previewSyncStatus: PreviewSyncStatus;
  initYDoc: (doc: Y.Doc) => void;
  destroyYDoc: () => void;
  storeBridge: DiagramCollaborationStoreBridge;
  resetRuntimeState: () => void;
  createProviderLifecycle: CreateDiagramCollaborationProviderLifecycle;
  handleProviderSetupFailed: (error: unknown) => void;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  documentMutationSession: DocumentMutationSession | null;
  documentCheckpointReader: DocumentCheckpointReader | null;
}

/**
 * 다이어그램 채널의 collaboration runtime 상태와 store binding을 조립한다.
 */
export function useDiagramCollaborationRuntime(
  diagram: DiagramDetail | undefined,
  documentBootstrap: DocumentBootstrapPayload | undefined,
  setupAttempt: number,
): UseDiagramCollaborationRuntimeReturn {
  const initYDoc = useCanvasStore((s) => s.initYDoc);
  const destroyYDoc = useCanvasStore((s) => s.destroyYDoc);
  const storeBridge = useDiagramCollaborationStoreBridge();
  const {
    collaborationBootstrap,
    previewEnabled,
    runtimeTransition,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    documentAdapter,
    transport,
    contentOnlySnapshotSeeder,
  } = useDiagramRuntimeBootstrap(diagram, documentBootstrap, setupAttempt);
  const { runtimeState, dispatchRuntimeEvent, resetRuntimeState } = useCollaborationSession({
    transition: runtimeTransition,
  });
  const previewSyncStatus = toPreviewSyncStatus(runtimeState, previewEnabled);
  const { documentMutationSession, documentCheckpointReader } = useDiagramDocumentRuntime({
    diagram,
    documentBootstrap,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    storeBridge,
  });

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
      const handoffLogPrefix = `[useDiagramCollaborationRuntime][diagramId=${diagramId}]`;
      if (
        !collaborationBootstrap ||
        !sharedDocumentEngine ||
        !snapshotCodec ||
        !contentOnlySnapshotSeeder
      ) {
        throw new Error('Diagram collaboration runtime bootstrap is not ready');
      }
      return createDiagramCollaborationProviderLifecycle(
        {
          ydoc,
          sharedDocumentEngine,
          snapshotCodec,
          bootstrap: collaborationBootstrap,
          previewEnabled,
          fallbackTimeoutMs: WS_SNAPSHOT_FALLBACK_MS,
          handoffStartedAt,
          handoffLogPrefix,
          documentAdapter,
          dispatchRuntimeEvent,
          updatePreviewMode,
          diagramId,
          teamId,
          projectId,
          storeBridge,
          onProviderReady,
          onProviderDisposed,
        },
        {
          transport,
          contentOnlySnapshotSeeder,
        },
      );
    },
    [
      collaborationBootstrap,
      contentOnlySnapshotSeeder,
      dispatchRuntimeEvent,
      documentAdapter,
      previewEnabled,
      sharedDocumentEngine,
      snapshotCodec,
      storeBridge,
      transport,
    ],
  );

  const handleProviderSetupFailed = useCallback(
    (_error: unknown) => {
      storeBridge.setConnectionStatus('disconnected');
      dispatchRuntimeEvent('setup-failed');
    },
    [dispatchRuntimeEvent, storeBridge],
  );

  return {
    collaborationBootstrap,
    previewSyncStatus,
    initYDoc,
    destroyYDoc,
    storeBridge,
    resetRuntimeState,
    createProviderLifecycle,
    handleProviderSetupFailed,
    sharedDocumentEngine,
    snapshotCodec,
    documentMutationSession,
    documentCheckpointReader,
  };
}
