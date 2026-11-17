import { useCallback, useRef, useState } from 'react';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import { isDiagramDocumentReady } from './diagram-document-mutation-session';
import * as Y from 'yjs';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import { useCollaborationSession } from '@/collaboration/core/use-collaboration-session';
import type { DiagramDocumentMutationSession as DocumentMutationSession } from './diagram-document-mutation-session';
import {
  toPreviewSyncStatus,
  type PreviewSyncStatus,
} from '@/collaboration/core/collaboration-preview-sync-status';
import { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentBootstrapPayload } from '@/types/document';
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
  canEdit: boolean,
): UseDiagramCollaborationRuntimeReturn {
  const connectionStatus = useCollaborationStore((state) => state.connectionStatus);
  const [synced, setSynced] = useState(false);
  const syncedRef = useRef(false);
  /** preview 여부. 아직 provider가 알리지 않았으면 null이며 이때는 previewEnabled를 따른다. */
  const previewRef = useRef<boolean | null>(null);
  const permissionRef = useRef(canEdit);
  permissionRef.current = canEdit;
  const isCommandReady = () =>
    isDiagramDocumentReady({
      localOnly: false,
      canEdit: permissionRef.current,
      hydrated: !(previewRef.current ?? previewEnabled),
      // 빈 room의 첫 입장자는 SYNC_STEP2를 받지 못할 수 있어 snapshot이 없는 문서는 연결 상태만 본다.
      synced: !previewEnabled || syncedRef.current,
      connectionStatus: useCollaborationStore.getState().connectionStatus,
    });
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
    isCommandReady,
    commandReady: isDiagramDocumentReady({
      localOnly: false,
      canEdit,
      hydrated: !(previewRef.current ?? previewEnabled),
      synced: !previewEnabled || synced,
      connectionStatus,
    }),
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
          dispatchRuntimeEvent,
          updatePreviewMode: (next) => {
            previewRef.current = next;
            updatePreviewMode(next);
          },
          onSyncStateChange: (next) => {
            syncedRef.current = next;
            setSynced(next);
          },
          diagramId,
          teamId,
          projectId,
          storeBridge,
          onProviderReady: (provider) => {
            syncedRef.current = false;
            previewRef.current = previewEnabled;
            setSynced(false);
            onProviderReady(provider);
          },
          onProviderDisposed: () => {
            syncedRef.current = false;
            previewRef.current = true;
            setSynced(false);
            onProviderDisposed();
          },
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
