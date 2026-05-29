import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type {
  DocumentChangeEvent,
  MutationMeta,
} from '@/collaboration/core/contracts/document-read-executor';
import type {
  DocumentCommand,
  PluginContext,
  ProjectionRefreshRequest,
} from '@/collaboration/core/contracts/document-plugin';
import type { DocumentCheckpointReader } from '@/collaboration/core/contracts/document-checkpoint';
import type {
  DocumentCommandDispatchResult,
  DocumentMutationSession,
} from '@/collaboration/core/session/document-mutation-session';
import type { ResolvedDocumentSessionBootstrap } from '@/collaboration/core/session/document-session-bootstrap';
import { DocumentPersistenceCoordinator } from '@/collaboration/core/persistence/document-persistence-coordinator';
import { resolveDocumentChangeOrigin } from '@/collaboration/core/store/document-change-origin';
import { DocumentRevisionTracker } from '@/collaboration/core/store/document-revision-tracker';
import { DocumentStore } from '@/collaboration/core/store/document-store';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DocumentChangeSummary } from '@/types/collaboration';
import { ScreenSpecDocumentMutationApplier } from '@/collaboration/plugins/screen-spec/screen-spec-document-mutation-applier';
import { ScreenSpecDocumentReadContextFactory } from '@/collaboration/plugins/screen-spec/query/screen-spec-document-read-context-factory';
import { collectScreenSpecAffectedScopes } from '@/collaboration/plugins/screen-spec/screen-spec-yjs-update-scope-collector';
import type { ScreenSpecYjsDocumentAdapter } from '@/collaboration/yjs/screen-spec-yjs-document-adapter';

interface UseScreenDesignDocumentRuntimeParams {
  documentDetail: DiagramDetail | undefined;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  documentAdapter: ScreenSpecYjsDocumentAdapter;
}

interface UseScreenDesignDocumentRuntimeResult {
  documentMutationSession: DocumentMutationSession | null;
  documentCheckpointReader: DocumentCheckpointReader | null;
  projectionVersion: number;
  lastDocumentChangeSummary: DocumentChangeSummary | null;
}

/**
 * 화면기획 문서용 DocumentStore runtime과 projection 상태를 조립한다.
 *
 * @param params 화면기획 문서 runtime 구성 요소
 * @returns mutation session, checkpoint reader, projection 상태
 */
export function useScreenDesignDocumentRuntime({
  documentDetail,
  resolvedSessionBootstrap,
  sharedDocumentEngine,
  snapshotCodec,
  documentAdapter,
}: UseScreenDesignDocumentRuntimeParams): UseScreenDesignDocumentRuntimeResult {
  const [projectionVersion, setProjectionVersion] = useState(0);
  const [lastDocumentChangeSummary, setLastDocumentChangeSummary] =
    useState<DocumentChangeSummary | null>(null);
  const projectionFrameRef = useRef<number | null>(null);
  const documentRevisionTracker = useMemo(
    () => new DocumentRevisionTracker(resolvedSessionBootstrap?.bootstrap.revision ?? '0'),
    [resolvedSessionBootstrap?.bootstrap.revision],
  );
  const documentMutationApplier = useMemo(
    () =>
      sharedDocumentEngine ? new ScreenSpecDocumentMutationApplier(sharedDocumentEngine) : null,
    [sharedDocumentEngine],
  );
  const documentReadContextFactory = useMemo(
    () =>
      sharedDocumentEngine
        ? new ScreenSpecDocumentReadContextFactory(sharedDocumentEngine, documentRevisionTracker)
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
            (update) => collectScreenSpecAffectedScopes(sharedDocumentEngine, update),
          )
        : null,
    [
      documentMutationApplier,
      documentReadContextFactory,
      documentRevisionTracker,
      sharedDocumentEngine,
    ],
  );
  const scheduleProjectionRefresh = useCallback((request?: ProjectionRefreshRequest) => {
    void request;
    if (projectionFrameRef.current !== null) {
      return;
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      projectionFrameRef.current = globalThis.setTimeout(() => {
        projectionFrameRef.current = null;
        setProjectionVersion((currentVersion) => currentVersion + 1);
      }, 0) as unknown as number;
      return;
    }
    projectionFrameRef.current = window.requestAnimationFrame(() => {
      projectionFrameRef.current = null;
      setProjectionVersion((currentVersion) => currentVersion + 1);
    });
  }, []);
  const pluginContext = useMemo<PluginContext | null>(
    () =>
      documentStore
        ? {
            read: documentStore,
            projectionBridge: {
              refreshPersistedView: scheduleProjectionRefresh,
            },
          }
        : null,
    [documentStore, scheduleProjectionRefresh],
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
  const documentMutationSession = useMemo<DocumentMutationSession | null>(() => {
    if (!documentStore || !documentMutationPolicy) {
      return null;
    }

    /**
     * command를 mutation으로 적용하고 typed result 형태로 감싼다.
     *
     * @param command 적용할 문서 command
     * @param meta 선택적 mutation 메타데이터
     * @returns 적용 결과와 선택적 값
     */
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
    });
  }, [
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
    return () => {
      if (projectionFrameRef.current === null) {
        return;
      }
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(projectionFrameRef.current);
        return;
      }
      clearTimeout(projectionFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!documentStore) {
      return;
    }
    return documentStore.subscribe((event) => {
      if (event.engineOrigin.source !== 'bootstrap') {
        scheduleProjectionRefresh({ scopeHints: event.affectedScopes });
      }
      for (const projector of documentProjectors) {
        projector.project(documentStore, event);
      }
      setLastDocumentChangeSummary(toDocumentChangeSummary(event));
    });
  }, [documentProjectors, documentStore, scheduleProjectionRefresh]);

  useEffect(() => {
    if (!sharedDocumentEngine) {
      return;
    }
    return sharedDocumentEngine.subscribeUpdates((update) => {
      documentRevisionTracker.handleDocumentUpdated(update);
      const origin = resolveDocumentChangeOrigin(update.origin);
      if (origin.source !== 'remote') {
        return;
      }
      const affectedScopes = collectScreenSpecAffectedScopes(sharedDocumentEngine, update);
      scheduleProjectionRefresh(
        affectedScopes.length > 0 ? { scopeHints: affectedScopes } : { forceFull: true },
      );
      setLastDocumentChangeSummary({
        revision: documentRevisionTracker.getRevision(),
        origin: 'remote',
        affectedScopes: affectedScopes.map((scope) => ({
          kind: scope.kind,
          id: scope.id,
          mode: scope.mode,
        })),
        changedAt: Date.now(),
      });
    });
  }, [documentRevisionTracker, scheduleProjectionRefresh, sharedDocumentEngine]);

  useEffect(() => {
    documentPersistenceCoordinator?.attach();
    return () => {
      documentPersistenceCoordinator?.dispose();
    };
  }, [documentPersistenceCoordinator]);

  useEffect(() => {
    if (!sharedDocumentEngine) {
      setProjectionVersion(0);
      setLastDocumentChangeSummary(null);
      return;
    }
    scheduleProjectionRefresh({ forceFull: true });
  }, [scheduleProjectionRefresh, sharedDocumentEngine, documentAdapter]);

  return {
    documentMutationSession,
    documentCheckpointReader: documentPersistenceCoordinator,
    projectionVersion,
    lastDocumentChangeSummary,
  };
}

/**
 * DocumentStore 변경 이벤트를 UI 친화적인 요약으로 변환한다.
 *
 * @param event 문서 변경 이벤트
 * @returns 최근 변경 요약
 */
function toDocumentChangeSummary(event: DocumentChangeEvent): DocumentChangeSummary {
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
