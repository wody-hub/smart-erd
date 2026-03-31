import type { RegisteredDocumentPlugin } from '@/collaboration/core/contracts/document-plugin.js';

export interface DocumentPluginRegistry {
  require(pluginId: string): RegisteredDocumentPlugin;
}
