import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { SharedDocumentEngine } from '@/collaboration/core/contracts/shared-document-engine';
import type { RegisteredDocumentPlugin } from '@/collaboration/core/contracts/document-plugin';
import type { DocumentPluginRegistry } from '@/collaboration/registry/document-plugin-registry';
import type { SharedDocumentEngineRegistry } from '@/collaboration/registry/shared-document-engine-registry';
import type { DocumentBootstrapPayload } from '@/types/document';

export interface ResolvedDocumentSessionBootstrap {
  bootstrap: DocumentBootstrapPayload;
  plugin: RegisteredDocumentPlugin;
  engine: SharedDocumentEngine;
  snapshotCodec: DocumentSnapshotCodec;
}

interface ResolveDocumentSessionBootstrapOptions {
  bootstrap: DocumentBootstrapPayload | undefined;
  pluginRegistry: DocumentPluginRegistry;
  engineRegistry: SharedDocumentEngineRegistry;
  createSnapshotCodec: (engineId: string) => DocumentSnapshotCodec;
}

/**
 * bootstrap payload를 실제 plugin/engine 구현체로 해상한다.
 */
export function resolveDocumentSessionBootstrap({
  bootstrap,
  pluginRegistry,
  engineRegistry,
  createSnapshotCodec,
}: ResolveDocumentSessionBootstrapOptions): ResolvedDocumentSessionBootstrap | null {
  if (!bootstrap) {
    return null;
  }

  try {
    const plugin = pluginRegistry.require(bootstrap.pluginId);
    if (!plugin.supportedEngineIds.includes(bootstrap.engineId)) {
      return null;
    }
    const engine = engineRegistry.require(bootstrap.engineId);
    return {
      bootstrap,
      plugin,
      engine,
      snapshotCodec: createSnapshotCodec(bootstrap.engineId),
    };
  } catch {
    return null;
  }
}
