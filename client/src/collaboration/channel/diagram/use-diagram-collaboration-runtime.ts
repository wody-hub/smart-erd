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
  getHydratedSnapshot: () => Uint8Array | null;
  getHydratedContentRevision: () => string | null;
  getRemoteHydrationGeneration: () => number;
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
  useCollaborationStore((state) => state.connectionStatus);
  const [, setInitializationComplete] = useState(false);
  const initializationRef = useRef({ complete: false });
  const initializationSourceRef = useRef<'waiting' | 'remote' | 'server-confirmed-empty'>(
    'waiting',
  );
  const hydratedContentRevisionRef = useRef<string | null>(null);
  const remoteHydrationGenerationRef = useRef(0);
  const contentRevisionRef = useRef(diagram?.contentRevision);
  contentRevisionRef.current = diagram?.contentRevision;
  const getHydratedContentRevision = useCallback(() => hydratedContentRevisionRef.current, []);
  const getRemoteHydrationGeneration = useCallback(() => remoteHydrationGenerationRef.current, []);
  const providerGenerationRef = useRef(0);
  const hydratedSnapshotRef = useRef<Uint8Array | null>(null);
  /** preview 여부. 아직 provider가 알리지 않았으면 null이며 이때는 previewEnabled를 따른다. */
  const previewRef = useRef<boolean | null>(null);
  const permissionRef = useRef(canEdit);
  permissionRef.current = canEdit;
  const isCommandReady = () =>
    isDiagramDocumentReady({
      localOnly: false,
      canEdit: permissionRef.current,
      hydrated: !(previewRef.current ?? previewEnabled),
      synced: initializationRef.current.complete,
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
  const getHydratedSnapshot = useCallback(() => {
    // 빈 문서 확인은 원격 수화가 아니며, 문서가 여전히 비어 있으면 저장 기준으로 쓰지 않는다.
    if (
      initializationSourceRef.current === 'server-confirmed-empty' &&
      (!sharedDocumentEngine || sharedDocumentEngine.exportSnapshot().length <= 2)
    )
      return null;
    return hydratedSnapshotRef.current;
  }, [sharedDocumentEngine]);
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
      const providerGeneration = ++providerGenerationRef.current;
      hydratedSnapshotRef.current = null;
      initializationSourceRef.current = 'waiting';
      initializationRef.current = { complete: false };
      const captureHydratedSnapshot = () => {
        if (
          initializationRef.current.complete &&
          !(previewRef.current ?? previewEnabled) &&
          !hydratedSnapshotRef.current
        ) {
          hydratedSnapshotRef.current = sharedDocumentEngine.exportSnapshot();
          hydratedContentRevisionRef.current =
            contentRevisionRef.current ?? collaborationBootstrap.contentRevision;
        }
      };
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
            if (providerGenerationRef.current !== providerGeneration) return;
            previewRef.current = next;
            captureHydratedSnapshot();
            updatePreviewMode(next);
          },
          onSyncStateChange: (next) => {
            if (providerGenerationRef.current !== providerGeneration) return;
            initializationRef.current.complete = next;
            initializationSourceRef.current = next ? 'remote' : 'waiting';
            if (next) remoteHydrationGenerationRef.current += 1;
            hydratedSnapshotRef.current = null;
            captureHydratedSnapshot();
            setInitializationComplete(next);
          },
          onEmptyDocumentInitialized: () => {
            if (
              providerGenerationRef.current !== providerGeneration ||
              initializationRef.current.complete ||
              useCollaborationStore.getState().connectionStatus !== 'connected' ||
              collaborationBootstrap.hasYdocSnapshot ||
              collaborationBootstrap.content ||
              previewEnabled
            )
              return;
            // 서버 확인은 이 연결만 초기화하며 실제 sync나 content 시딩으로 취급하지 않는다.
            initializationSourceRef.current = 'server-confirmed-empty';
            initializationRef.current.complete = true;
            captureHydratedSnapshot();
            setInitializationComplete(true);
          },
          onConnectionStatusChange: () => {
            if (providerGenerationRef.current !== providerGeneration) return;
            // 모든 연결 세대는 새 sync 또는 서버의 빈 문서 확인을 기다린다.
            initializationSourceRef.current = 'waiting';
            hydratedSnapshotRef.current = null;
            initializationRef.current.complete = false;
            setInitializationComplete(false);
          },
          diagramId,
          teamId,
          projectId,
          storeBridge,
          onProviderReady: (provider) => {
            if (providerGenerationRef.current !== providerGeneration) return;
            initializationRef.current.complete = false;
            previewRef.current = previewEnabled;
            setInitializationComplete(false);
            onProviderReady(provider);
          },
          onProviderDisposed: () => {
            if (providerGenerationRef.current !== providerGeneration) return;
            initializationRef.current.complete = false;
            previewRef.current = true;
            setInitializationComplete(false);
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
    getHydratedSnapshot,
    getHydratedContentRevision,
    getRemoteHydrationGeneration,
  };
}
