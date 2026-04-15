import { useMemo, useRef } from 'react';
import type { DiagramDetail } from '@/types/diagram';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { PassthroughDocumentSnapshotCodec } from '@/collaboration/core/persistence/passthrough-document-snapshot-codec';
import {
  resolveDocumentSessionBootstrap,
  type ResolvedDocumentSessionBootstrap,
} from '@/collaboration/core/session/document-session-bootstrap';
import { StaticDocumentPluginRegistry } from '@/collaboration/registry/static-document-plugin-registry';
import { StaticSharedDocumentEngineRegistry } from '@/collaboration/registry/static-shared-document-engine-registry';
import {
  MARKDOWN_DOCUMENT_ENGINE_ID,
  MARKDOWN_DOCUMENT_PLUGIN_ID,
  createMarkdownDocumentPlugin,
} from '@/collaboration/plugins/markdown/markdown-document-plugin';
import type { DocumentBootstrapPayload } from '@/types/document';
import type { MarkdownCollaborationBootstrap } from './markdown-collaboration-bootstrap';
import { MarkdownYjsDocumentAdapter } from '@/collaboration/yjs/markdown-yjs-document-adapter';

interface UseMarkdownRuntimeBootstrapResult {
  collaborationBootstrap: MarkdownCollaborationBootstrap | null;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  documentAdapter: MarkdownYjsDocumentAdapter;
}

/**
 * markdown collaboration runtime에 필요한 plugin/engine/bootstrap을 해상한다.
 */
export function useMarkdownRuntimeBootstrap(
  documentDetail: DiagramDetail | undefined,
  documentBootstrap: DocumentBootstrapPayload | undefined,
  setupAttempt: number,
): UseMarkdownRuntimeBootstrapResult {
  const resolvedSessionBootstrapRef = useRef<{
    key: string | null;
    value: ResolvedDocumentSessionBootstrap | null;
  }>({
    key: null,
    value: null,
  });
  const documentAdapter = useMemo(() => new MarkdownYjsDocumentAdapter(), []);
  const pluginRegistry = useMemo(
    () => new StaticDocumentPluginRegistry([createMarkdownDocumentPlugin()]),
    [],
  );
  const engineRegistry = useMemo(
    () =>
      new StaticSharedDocumentEngineRegistry([
        {
          engineId: MARKDOWN_DOCUMENT_ENGINE_ID,
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
      resolvedSessionBootstrap?.engine.engineId === MARKDOWN_DOCUMENT_ENGINE_ID
        ? (resolvedSessionBootstrap.engine as YjsSharedDocumentEngine)
        : null,
    [resolvedSessionBootstrap],
  );
  const snapshotCodec = resolvedSessionBootstrap?.snapshotCodec ?? null;
  const collaborationBootstrap = useMemo<MarkdownCollaborationBootstrap | null>(() => {
    if (
      !documentDetail ||
      !resolvedSessionBootstrap ||
      resolvedSessionBootstrap.bootstrap.pluginId !== MARKDOWN_DOCUMENT_PLUGIN_ID ||
      resolvedSessionBootstrap.bootstrap.engineId !== MARKDOWN_DOCUMENT_ENGINE_ID
    ) {
      return null;
    }
    return {
      content: documentDetail.content,
      hasYdocSnapshot: resolvedSessionBootstrap.bootstrap.snapshotAvailable,
      contentRevision: documentDetail.contentRevision,
    };
  }, [documentDetail, resolvedSessionBootstrap]);

  return {
    collaborationBootstrap,
    resolvedSessionBootstrap,
    sharedDocumentEngine,
    snapshotCodec,
    documentAdapter,
  };
}
