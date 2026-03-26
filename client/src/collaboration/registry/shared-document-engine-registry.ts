import type { SharedDocumentEngine } from '@/collaboration/core/contracts/shared-document-engine.js';

export interface SharedDocumentEngineRegistry {
  require(engineId: string): SharedDocumentEngine;
}
