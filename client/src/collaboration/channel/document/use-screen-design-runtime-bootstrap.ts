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
import type { DocumentBootstrapPayload } from '@/types/document';
import {
  SCREEN_SPEC_DOCUMENT_ENGINE_ID,
  SCREEN_SPEC_DOCUMENT_PLUGIN_ID,
  createScreenSpecDocumentPlugin,
} from '@/collaboration/plugins/screen-spec/screen-spec-document-plugin';
import type { ScreenDesignCollaborationBootstrap } from './screen-design-collaboration-bootstrap';
import { ScreenSpecYjsDocumentAdapter } from '@/collaboration/yjs/screen-spec-yjs-document-adapter';

interface UseScreenDesignRuntimeBootstrapResult {
  collaborationBootstrap: ScreenDesignCollaborationBootstrap | null;
  resolvedSessionBootstrap: ResolvedDocumentSessionBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  documentAdapter: ScreenSpecYjsDocumentAdapter;
}

/**
 * 화면기획 문서 runtime에 필요한 plugin/engine/bootstrap을 해상한다.
 *
 * @param documentDetail 현재 문서 상세
 * @param documentBootstrap 협업 bootstrap 헤더
 * @param setupAttempt 협업 세션 재시도 카운터
 * @returns 화면기획 runtime bootstrap 결과
 */
export function useScreenDesignRuntimeBootstrap(
  documentDetail: DiagramDetail | undefined,
  documentBootstrap: DocumentBootstrapPayload | undefined,
  setupAttempt: number,
): UseScreenDesignRuntimeBootstrapResult {
  const resolvedSessionBootstrapRef = useRef<{
    key: string | null;
    value: ResolvedDocumentSessionBootstrap | null;
  }>({
    key: null,
    value: null,
  });
  const documentAdapter = useMemo(() => new ScreenSpecYjsDocumentAdapter(), []);
  const pluginRegistry = useMemo(
    () => new StaticDocumentPluginRegistry([createScreenSpecDocumentPlugin()]),
    [],
  );
  const engineRegistry = useMemo(
    () =>
      new StaticSharedDocumentEngineRegistry([
        {
          engineId: SCREEN_SPEC_DOCUMENT_ENGINE_ID,
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
  }, [documentBootstrap, setupAttempt]);
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
      resolvedSessionBootstrap?.engine.engineId === SCREEN_SPEC_DOCUMENT_ENGINE_ID
        ? (resolvedSessionBootstrap.engine as YjsSharedDocumentEngine)
        : null,
    [resolvedSessionBootstrap],
  );
  const snapshotCodec = resolvedSessionBootstrap?.snapshotCodec ?? null;
  const collaborationBootstrap = useMemo<ScreenDesignCollaborationBootstrap | null>(() => {
    if (
      !documentDetail ||
      !resolvedSessionBootstrap ||
      resolvedSessionBootstrap.bootstrap.pluginId !== SCREEN_SPEC_DOCUMENT_PLUGIN_ID ||
      resolvedSessionBootstrap.bootstrap.engineId !== SCREEN_SPEC_DOCUMENT_ENGINE_ID
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
