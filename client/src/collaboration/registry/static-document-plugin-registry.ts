import type { RegisteredDocumentPlugin } from '@/collaboration/core/contracts/document-plugin';
import type { DocumentPluginRegistry } from '@/collaboration/registry/document-plugin-registry';

/**
 * 프로세스 내부 정적 문서 플러그인 레지스트리.
 */
export class StaticDocumentPluginRegistry implements DocumentPluginRegistry {
  private readonly plugins = new Map<string, RegisteredDocumentPlugin>();

  constructor(plugins: RegisteredDocumentPlugin[]) {
    for (const plugin of plugins) {
      this.plugins.set(plugin.pluginId, plugin);
    }
  }

  require(pluginId: string): RegisteredDocumentPlugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Unsupported document plugin: ${pluginId}`);
    }
    return plugin;
  }
}
