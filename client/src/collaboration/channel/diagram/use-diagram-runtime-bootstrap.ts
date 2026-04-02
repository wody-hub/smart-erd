import { useMemo, useRef } from 'react';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { PassthroughDocumentSnapshotCodec } from '@/collaboration/core/persistence/passthrough-document-snapshot-codec';
import {
  resolveDocumentSessionBootstrap,
  type ResolvedDocumentSessionBootstrap,
} from '@/collaboration/core/session/document-session-bootstrap';
import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from '@/collaboration/core/collaboration-runtime-types';
import { StaticDocumentPluginRegistry } from '@/collaboration/registry/static-document-plugin-registry';
import { StaticSharedDocumentEngineRegistry } from '@/collaboration/registry/static-shared-document-engine-registry';
import {
  ERD_DOCUMENT_ENGINE_ID,
  ERD_DOCUMENT_PLUGIN_ID,
  createErdDocumentPlugin,
} from '@/collaboration/plugins/erd/erd-document-plugin';
import type { DocumentBootstrapPayload } from '@/types/document';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import { DiagramCollaborationPreviewPolicy } from './diagram-collaboration-preview-policy.js';
import { DiagramCollaborationTransport } from './diagram-collaboration-transport.js';
import { DiagramContentOnlySnapshotSeeder } from './diagram-content-only-snapshot-seeder.js';
import { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';

interface UseDiagramRuntimeBootstrapResult {
  collaborationBootstrap: DiagramCollaborationBootstrap | null;
  previewEnabled: boolean;
  runtimeTransition: (
    currentState: CollaborationRuntimeState,
    event: CollaborationRuntimeEvent,
  ) => CollaborationRuntimeState;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  documentAdapter: DiagramYjsDocumentAdapter;
  transport: DiagramCollaborationTransport;
  contentOnlySnapshotSeeder: DiagramContentOnlySnapshotSeeder | null;
}

export function useDiagramRuntimeBootstrap(
  diagram: DiagramDetail | undefined,
  documentBootstrap: DocumentBootstrapPayload | undefined,
  setupAttempt: number,
): UseDiagramRuntimeBootstrapResult {
  const resolvedSessionBootstrapRef = useRef<{
    key: string | null;
    value: ResolvedDocumentSessionBootstrap | null;
  }>({
    key: null,
    value: null,
  });
  const collaborationBootstrapRef = useRef<{
    key: string | null;
    value: DiagramCollaborationBootstrap | null;
  }>({
    key: null,
    value: null,
  });
  const previewPolicy = useMemo(() => new DiagramCollaborationPreviewPolicy(), []);
  const runtimeTransition = useMemo(
    () => previewPolicy.transition.bind(previewPolicy),
    [previewPolicy],
  );
  const documentAdapter = useMemo(() => new DiagramYjsDocumentAdapter(), []);
  const transport = useMemo(() => new DiagramCollaborationTransport(), []);
  const pluginRegistry = useMemo(
    () => new StaticDocumentPluginRegistry([createErdDocumentPlugin()]),
    [],
  );
  const engineRegistry = useMemo(
    () =>
      new StaticSharedDocumentEngineRegistry([
        {
          engineId: ERD_DOCUMENT_ENGINE_ID,
          create: () => new YjsSharedDocumentEngine(),
        },
      ]),
    [],
  );
  const resolvedBootstrapKey = useMemo(() => {
    if (!documentBootstrap) {
      return null;
    }
    return [
      documentBootstrap.pluginId,
      documentBootstrap.engineId,
      documentBootstrap.pluginSchemaVersion,
      documentBootstrap.snapshotFormatVersion,
      setupAttempt,
    ].join(':');
  }, [
    documentBootstrap?.engineId,
    documentBootstrap?.pluginId,
    documentBootstrap?.pluginSchemaVersion,
    documentBootstrap?.snapshotFormatVersion,
    setupAttempt,
  ]);
  const resolvedSessionBootstrap = useMemo(() => {
    if (!documentBootstrap || !resolvedBootstrapKey) {
      resolvedSessionBootstrapRef.current = {
        key: null,
        value: null,
      };
      return null;
    }
    if (
      resolvedSessionBootstrapRef.current.key === resolvedBootstrapKey &&
      resolvedSessionBootstrapRef.current.value
    ) {
      return resolvedSessionBootstrapRef.current.value;
    }
    const nextResolvedBootstrap = resolveDocumentSessionBootstrap({
      bootstrap: documentBootstrap,
      pluginRegistry,
      engineRegistry,
      createSnapshotCodec: () => new PassthroughDocumentSnapshotCodec(),
    });
    resolvedSessionBootstrapRef.current = {
      key: resolvedBootstrapKey,
      value: nextResolvedBootstrap,
    };
    return nextResolvedBootstrap;
  }, [documentBootstrap, engineRegistry, pluginRegistry, resolvedBootstrapKey]);
  const sharedDocumentEngine = useMemo(
    () =>
      resolvedSessionBootstrap?.engine.engineId === ERD_DOCUMENT_ENGINE_ID
        ? (resolvedSessionBootstrap.engine as YjsSharedDocumentEngine)
        : null,
    [resolvedSessionBootstrap],
  );
  const snapshotCodec = resolvedSessionBootstrap?.snapshotCodec ?? null;
  const contentOnlySnapshotSeeder = useMemo(
    () =>
      snapshotCodec ? new DiagramContentOnlySnapshotSeeder(documentAdapter, snapshotCodec) : null,
    [documentAdapter, snapshotCodec],
  );
  const collaborationBootstrapKey = useMemo(() => {
    if (
      !diagram ||
      !resolvedSessionBootstrap ||
      resolvedSessionBootstrap.bootstrap.pluginId !== ERD_DOCUMENT_PLUGIN_ID ||
      resolvedSessionBootstrap.bootstrap.engineId !== ERD_DOCUMENT_ENGINE_ID
    ) {
      return null;
    }
    return `${diagram.id}:${resolvedBootstrapKey ?? 'unknown'}`;
  }, [diagram?.id, resolvedBootstrapKey, resolvedSessionBootstrap]);
  const collaborationBootstrap = useMemo<DiagramCollaborationBootstrap | null>(() => {
    if (!collaborationBootstrapKey || !diagram || !resolvedSessionBootstrap) {
      collaborationBootstrapRef.current = {
        key: null,
        value: null,
      };
      return null;
    }
    if (
      collaborationBootstrapRef.current.key === collaborationBootstrapKey &&
      collaborationBootstrapRef.current.value
    ) {
      return collaborationBootstrapRef.current.value;
    }
    const nextCollaborationBootstrap = {
      content: diagram.content,
      hasYdocSnapshot: resolvedSessionBootstrap.bootstrap.snapshotAvailable,
      contentRevision: diagram.contentRevision,
    };
    collaborationBootstrapRef.current = {
      key: collaborationBootstrapKey,
      value: nextCollaborationBootstrap,
    };
    return nextCollaborationBootstrap;
  }, [
    collaborationBootstrapKey,
    diagram?.content,
    diagram?.contentRevision,
    resolvedSessionBootstrap,
  ]);
  const previewEnabled = Boolean(
    collaborationBootstrap && previewPolicy.shouldStartInPreview(collaborationBootstrap),
  );

  return {
    collaborationBootstrap,
    previewEnabled,
    runtimeTransition,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    documentAdapter,
    transport,
    contentOnlySnapshotSeeder,
  };
}
