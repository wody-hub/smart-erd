import { useCallback, useEffect, useMemo } from 'react';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type {
  DocumentChangeEvent,
  MutationMeta,
} from '@/collaboration/core/contracts/document-read-executor';
import type {
  ArtifactFallbackCapablePlugin,
  DocumentCommand,
  PluginContext,
} from '@/collaboration/core/contracts/document-plugin';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type {
  DocumentCommandDispatchResult,
  DocumentMutationSession,
} from '@/collaboration/core/session/document-mutation-session';
import type { ResolvedDocumentSessionBootstrap } from '@/collaboration/core/session/document-session-bootstrap';
import { DocumentPersistenceCoordinator } from '@/collaboration/core/persistence/document-persistence-coordinator';
import { DocumentRevisionTracker } from '@/collaboration/core/store/document-revision-tracker';
import { DocumentStore } from '@/collaboration/core/store/document-store';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { MarkdownDocumentMutationApplier } from '@/collaboration/plugins/markdown/markdown-document-mutation-applier';
import { MarkdownDocumentReadContextFactory } from '@/collaboration/plugins/markdown/query/markdown-document-read-context-factory';
import { MarkdownYjsDocumentAdapter } from '@/collaboration/yjs/markdown-yjs-document-adapter';

interface UseMarkdownDocumentRuntimeParams {
  documentDetail: DiagramDetail | undefined;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  documentAdapter: MarkdownYjsDocumentAdapter;
}

interface UseMarkdownDocumentRuntimeResult {
  documentMutationSession: DocumentMutationSession | null;
  documentCheckpointReader: DocumentCheckpointReader | null;
  subscribeDocumentChanges: ((listener: (event: DocumentChangeEvent) => void) => () => void) | null;
  readSerializedBuffer: () => string;
}

/**
 * markdown shared document를 DocumentStore/MutationSession으로 조립한다.
 */
export function useMarkdownDocumentRuntime({
  documentDetail,
  resolvedSessionBootstrap,
  sharedDocumentEngine,
  snapshotCodec,
  documentAdapter,
}: UseMarkdownDocumentRuntimeParams): UseMarkdownDocumentRuntimeResult {
  const documentRevisionTracker = useMemo(
    () => new DocumentRevisionTracker(resolvedSessionBootstrap?.bootstrap.revision ?? '0'),
    [resolvedSessionBootstrap?.bootstrap.revision],
  );
  const documentMutationApplier = useMemo(
    () =>
      sharedDocumentEngine
        ? new MarkdownDocumentMutationApplier(sharedDocumentEngine, documentAdapter)
        : null,
    [documentAdapter, sharedDocumentEngine],
  );
  const documentReadContextFactory = useMemo(
    () =>
      sharedDocumentEngine
        ? new MarkdownDocumentReadContextFactory(
            sharedDocumentEngine,
            documentRevisionTracker,
            documentAdapter,
          )
        : null,
    [documentAdapter, documentRevisionTracker, sharedDocumentEngine],
  );
  const documentStore = useMemo(
    () =>
      sharedDocumentEngine && documentMutationApplier && documentReadContextFactory
        ? new DocumentStore(
            documentMutationApplier,
            documentRevisionTracker,
            documentReadContextFactory,
            () => sharedDocumentEngine.exportSnapshot(),
            () => [
              {
                kind: 'document',
                id: 'root',
                mode: 'exclusive',
              },
            ],
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
          }
        : null,
    [documentStore],
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
  }, [documentInputAdapters, documentMutationPolicy, documentStore]);
  const documentPersistenceCoordinator = useMemo(() => {
    if (!documentDetail || !resolvedSessionBootstrap || !sharedDocumentEngine || !snapshotCodec) {
      return null;
    }
    return new DocumentPersistenceCoordinator({
      metadata: {
        documentId: documentDetail.id,
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
    documentArtifactSerializer,
    documentDetail,
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

  const subscribeDocumentChanges = useCallback(
    (listener: (event: DocumentChangeEvent) => void) =>
      documentStore ? documentStore.subscribe(listener) : () => undefined,
    [documentStore],
  );
  const readSerializedBuffer = useCallback(
    () =>
      sharedDocumentEngine
        ? documentAdapter.serializeBuffer(sharedDocumentEngine.getDocument())
        : '',
    [documentAdapter, sharedDocumentEngine],
  );

  return {
    documentMutationSession,
    documentCheckpointReader: documentPersistenceCoordinator,
    subscribeDocumentChanges: documentStore ? subscribeDocumentChanges : null,
    readSerializedBuffer,
  };
}
