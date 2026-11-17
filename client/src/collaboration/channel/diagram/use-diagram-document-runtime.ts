import useCanvasStore from '@/stores/erd/useCanvasStore';
import { useEffect, useMemo, useRef } from 'react';
import { createDiagramDocumentMutationSession } from './diagram-document-mutation-session';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type { DocumentChangeEvent } from '@/collaboration/core/contracts/document-read-executor';
import type {
  ArtifactFallbackCapablePlugin,
  PluginContext,
  RegisteredDocumentPlugin,
} from '@/collaboration/core/contracts/document-plugin';
import type { DiagramDocumentMutationSession as DocumentMutationSession } from './diagram-document-mutation-session';
import type { ResolvedDocumentSessionBootstrap } from '@/collaboration/core/session/document-session-bootstrap';
import { DocumentPersistenceCoordinator } from '@/collaboration/core/persistence/document-persistence-coordinator';
import { DocumentRevisionTracker } from '@/collaboration/core/store/document-revision-tracker';
import { DocumentStore } from '@/collaboration/core/store/document-store';
import { ErdDocumentMutationApplier } from '@/collaboration/plugins/erd/erd-document-mutation-applier';
import { ErdDocumentReadContextFactory } from '@/collaboration/plugins/erd/query/erd-document-read-context-factory';
import { collectErdAffectedScopes } from '@/collaboration/plugins/erd/erd-yjs-update-scope-collector';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { DocumentBootstrapPayload } from '@/types/document';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';

interface UseDiagramDocumentRuntimeParams {
  diagram: DiagramDetail | undefined;
  documentBootstrap: DocumentBootstrapPayload | undefined;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  storeBridge: DiagramCollaborationStoreBridge;
  plugin?: RegisteredDocumentPlugin;
  isCommandReady: () => boolean;
  commandReady: boolean;
}

interface UseDiagramDocumentRuntimeResult {
  documentMutationSession: DocumentMutationSession | null;
  documentCheckpointReader: DocumentCheckpointReader | null;
}

export function useDiagramDocumentRuntime({
  diagram,
  documentBootstrap,
  resolvedSessionBootstrap,
  sharedDocumentEngine,
  snapshotCodec,
  storeBridge,
  plugin: localPlugin,
  isCommandReady,
  commandReady,
}: UseDiagramDocumentRuntimeParams): UseDiagramDocumentRuntimeResult {
  const engineRef = useRef(sharedDocumentEngine);
  engineRef.current = sharedDocumentEngine;
  const readyRef = useRef(isCommandReady);
  readyRef.current = isCommandReady;
  const plugin = localPlugin ?? resolvedSessionBootstrap?.plugin;
  const documentRevisionTracker = useMemo(
    () => new DocumentRevisionTracker(documentBootstrap?.revision ?? '0'),
    [documentBootstrap?.revision],
  );
  const documentMutationApplier = useMemo(
    () =>
      sharedDocumentEngine
        ? new ErdDocumentMutationApplier(sharedDocumentEngine, () =>
            useCanvasStore.getState().stopHistoryCapture(),
          )
        : null,
    [sharedDocumentEngine],
  );
  const documentReadContextFactory = useMemo(
    () =>
      sharedDocumentEngine
        ? new ErdDocumentReadContextFactory(sharedDocumentEngine, documentRevisionTracker)
        : null,
    [documentRevisionTracker, sharedDocumentEngine],
  );
  const documentStore = useMemo(
    () =>
      sharedDocumentEngine && documentMutationApplier && documentReadContextFactory
        ? new DocumentStore(
            documentMutationApplier,
            documentRevisionTracker,
            documentReadContextFactory,
            () => sharedDocumentEngine.exportSnapshot(),
            (update) => collectErdAffectedScopes(sharedDocumentEngine, update),
          )
        : null,
    [
      documentMutationApplier,
      documentReadContextFactory,
      documentRevisionTracker,
      sharedDocumentEngine,
    ],
  );
  const pluginContext = useMemo<PluginContext | null>(
    () =>
      documentStore
        ? {
            read: documentStore,
            projectionBridge: {
              refreshPersistedView: storeBridge.refreshPersistedCanvasFromYDoc,
            },
          }
        : null,
    [documentStore, storeBridge.refreshPersistedCanvasFromYDoc],
  );
  const documentMutationPolicy = useMemo(
    () => (plugin && pluginContext ? plugin.createMutationPolicy(pluginContext) : null),
    [pluginContext, plugin],
  );
  const documentInputAdapters = useMemo(
    () => (plugin && pluginContext ? plugin.createInputAdapters(pluginContext) : null),
    [pluginContext, plugin],
  );
  const documentProjectors = useMemo(
    () => (plugin && pluginContext ? plugin.createProjectors(pluginContext) : []),
    [pluginContext, plugin],
  );
  const documentArtifactSerializer = useMemo(
    () =>
      plugin && pluginContext && 'createArtifactSerializer' in plugin
        ? (plugin as ArtifactFallbackCapablePlugin).createArtifactSerializer(pluginContext)
        : null,
    [pluginContext, plugin],
  );
  const documentMutationSession = useMemo<DocumentMutationSession | null>(() => {
    if (!documentStore || !documentMutationPolicy) {
      return null;
    }

    const session = createDiagramDocumentMutationSession(
      documentStore,
      documentMutationPolicy,
      documentInputAdapters,
      () => engineRef.current === sharedDocumentEngine && readyRef.current(),
      () => storeBridge.refreshPersistedCanvasFromYDoc({ forceFull: true }),
    );
    return { ...session, ready: commandReady };
  }, [
    documentInputAdapters,
    documentMutationPolicy,
    documentStore,
    storeBridge,
    commandReady,
    sharedDocumentEngine,
  ]);
  const documentPersistenceCoordinator = useMemo(() => {
    if (!diagram || !resolvedSessionBootstrap || !sharedDocumentEngine || !snapshotCodec) {
      return null;
    }
    return new DocumentPersistenceCoordinator({
      metadata: {
        documentId: diagram.id,
        pluginId: resolvedSessionBootstrap.bootstrap.pluginId,
        engineId: resolvedSessionBootstrap.bootstrap.engineId,
        pluginSchemaVersion: resolvedSessionBootstrap.bootstrap.pluginSchemaVersion,
      },
      revisionSource: documentRevisionTracker,
      snapshotCodec,
      exportSnapshot: () => sharedDocumentEngine.exportSnapshot(),
      artifactSerializer: documentArtifactSerializer,
    });
  }, [
    diagram?.id,
    documentArtifactSerializer,
    documentRevisionTracker,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
  ]);

  useEffect(() => {
    documentStore?.attach();
    return () => {
      documentStore?.dispose();
    };
  }, [documentStore]);

  useEffect(() => {
    if (!documentStore) {
      return;
    }
    return documentStore.subscribe((event) => {
      for (const projector of documentProjectors) {
        projector.project(documentStore, event);
      }
      storeBridge.applyDocumentChange(toDocumentChangeSummary(event));
    });
  }, [documentProjectors, documentStore, storeBridge]);

  useEffect(() => {
    if (!sharedDocumentEngine) {
      return;
    }
    return sharedDocumentEngine.subscribeUpdates((update) => {
      documentRevisionTracker.handleDocumentUpdated(update);
    });
  }, [documentRevisionTracker, sharedDocumentEngine]);

  useEffect(() => {
    documentPersistenceCoordinator?.attach();
    return () => {
      documentPersistenceCoordinator?.dispose();
    };
  }, [documentPersistenceCoordinator]);

  return {
    documentMutationSession,
    documentCheckpointReader: documentPersistenceCoordinator,
  };
}

function toDocumentChangeSummary(event: DocumentChangeEvent) {
  return {
    revision: event.revision,
    origin: event.origin.source,
    affectedScopes: event.affectedScopes.map((scope) => ({
      kind: scope.kind,
      id: scope.id,
      mode: scope.mode,
    })),
    changedAt: Date.now(),
  };
}
