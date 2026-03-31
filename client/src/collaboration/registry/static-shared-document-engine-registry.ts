import type { SharedDocumentEngine } from '@/collaboration/core/contracts/shared-document-engine';
import type { SharedDocumentEngineRegistry } from '@/collaboration/registry/shared-document-engine-registry';

type SharedDocumentEngineFactory = () => SharedDocumentEngine;

/**
 * 프로세스 내부 정적 shared document engine 레지스트리.
 */
export class StaticSharedDocumentEngineRegistry implements SharedDocumentEngineRegistry {
  private readonly factories = new Map<string, SharedDocumentEngineFactory>();

  constructor(entries: Array<{ engineId: string; create: SharedDocumentEngineFactory }>) {
    for (const entry of entries) {
      this.factories.set(entry.engineId, entry.create);
    }
  }

  require(engineId: string): SharedDocumentEngine {
    const factory = this.factories.get(engineId);
    if (!factory) {
      throw new Error(`Unsupported shared document engine: ${engineId}`);
    }
    return factory();
  }
}
