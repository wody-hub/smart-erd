import { useEffect, useMemo } from 'react';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentBootstrapPayload } from '@/collaboration/core/contracts/document-bootstrap';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type {
  DocumentChangeEvent,
  MutationMeta,
} from '@/collaboration/core/contracts/document-read-executor';
import type {
  ArtifactFallbackCapablePlugin,
  DocumentCommand,
  PluginContext,
} from '@/collaboration/core/contracts/document-plugin';
import type {
  DocumentCommandDispatchResult,
  DocumentMutationSession,
} from '@/collaboration/core/session/document-mutation-session';
import type { ResolvedDocumentSessionBootstrap } from '@/collaboration/core/session/document-session-bootstrap';
import { DocumentPersistenceCoordinator } from '@/collaboration/core/persistence/document-persistence-coordinator';
import { DocumentRevisionTracker } from '@/collaboration/core/store/document-revision-tracker';
import { DocumentStore } from '@/collaboration/core/store/document-store';
import { ErdDocumentMutationApplier } from '@/collaboration/plugins/erd/erd-document-mutation-applier';
import { ErdDocumentReadContextFactory } from '@/collaboration/plugins/erd/query/erd-document-read-context-factory';
import { collectErdAffectedScopes } from '@/collaboration/plugins/erd/erd-yjs-update-scope-collector';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';

interface UseDiagramDocumentRuntimeParams {
  diagram: DiagramDetail | undefined;
  documentBootstrap: DocumentBootstrapPayload | undefined;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  storeBridge: DiagramCollaborationStoreBridge;
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
}: UseDiagramDocumentRuntimeParams): UseDiagramDocumentRuntimeResult {
  const documentRevisionTracker = useMemo(
    () => new DocumentRevisionTracker(documentBootstrap?.revision ?? '0'),
    [documentBootstrap?.revision],
  );
  const documentMutationApplier = useMemo(
    () => (sharedDocumentEngine ? new ErdDocumentMutationApplier(sharedDocumentEngine) : null),
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
    () =>
      resolvedSessionBootstrap && pluginContext
        ? resolvedSessionBootstrap.plugin.createMutationPolicy(pluginContext)
        : null,
    [pluginContext, resolvedSessionBootstrap],
  );
  const documentInputAdapters = useMemo(
    () =>
      resolvedSessionBootstrap && pluginContext
        ? resolvedSessionBootstrap.plugin.createInputAdapters(pluginContext)
        : null,
    [pluginContext, resolvedSessionBootstrap],
  );
  const documentProjectors = useMemo(
    () =>
      resolvedSessionBootstrap && pluginContext
        ? resolvedSessionBootstrap.plugin.createProjectors(pluginContext)
        : [],
    [pluginContext, resolvedSessionBootstrap],
  );
  const documentArtifactSerializer = useMemo(
    () =>
      resolvedSessionBootstrap &&
      pluginContext &&
      'createArtifactSerializer' in resolvedSessionBootstrap.plugin
        ? (
            resolvedSessionBootstrap.plugin as ArtifactFallbackCapablePlugin
          ).createArtifactSerializer(pluginContext)
        : null,
    [pluginContext, resolvedSessionBootstrap],
  );
  const documentMutationSession = useMemo<DocumentMutationSession | null>(() => {
    if (!documentStore || !documentMutationPolicy) {
      return null;
    }

    const emitCommandWithResult = <T>(
      command: DocumentCommand,
      meta?: MutationMeta,
    ): DocumentCommandDispatchResult<T> => {
      const resolvedMeta: MutationMeta = meta ?? {
        origin: {
          source: 'local',
        },
      };
      const result = documentStore.applyMutation<T>(
        documentMutationPolicy.toMutation(command, resolvedMeta),
        resolvedMeta,
      );
      if (!result.applied) {
        storeBridge.refreshPersistedCanvasFromYDoc({ forceFull: true });
        return {
          status: 'rejected',
        };
      }
      return {
        status: 'applied',
        value: result.value,
      };
    };

    return {
      enabled: true,
      inputAdapters: documentInputAdapters,
      read: documentStore,
      emitCommand: (command: DocumentCommand, meta?: MutationMeta) =>
        emitCommandWithResult(command, meta).status,
      emitCommandWithResult,
    };
  }, [documentInputAdapters, documentMutationPolicy, documentStore, storeBridge]);
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
