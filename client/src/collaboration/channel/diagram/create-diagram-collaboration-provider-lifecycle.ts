import { DiagramCollaborationProviderBinding } from './diagram-collaboration-provider-binding.js';
import { DiagramPreviewHydrationController } from './diagram-preview-hydration-controller.js';
import { DiagramCollaborationProviderEvents } from './diagram-collaboration-provider-events.js';
import {
  DiagramCollaborationProviderLifecycle,
  type DiagramCollaborationProviderLifecycleDependencies,
  type DiagramCollaborationProviderLifecycleOptions,
} from './diagram-collaboration-provider-lifecycle.js';
import type { CollaborationRuntimeEvent } from '../../core/collaboration-runtime-types.js';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';
import type { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';

export interface CreateDiagramCollaborationProviderLifecycleOptions
  extends DiagramCollaborationProviderLifecycleOptions {
  previewEnabled: boolean;
  fallbackTimeoutMs: number;
  documentAdapter: DiagramYjsDocumentAdapter;
  dispatchRuntimeEvent: (event: CollaborationRuntimeEvent) => void;
  updatePreviewMode: (next: boolean) => void;
  storeBridge: DiagramCollaborationStoreBridge;
}

/**
 * 다이어그램 채널 provider lifecycle collaborator를 조립하고 lifecycle 인스턴스를 생성한다.
 */
export function createDiagramCollaborationProviderLifecycle(
  options: CreateDiagramCollaborationProviderLifecycleOptions,
  dependencies: Omit<
    DiagramCollaborationProviderLifecycleDependencies,
    'previewHydrationController' | 'providerBinding' | 'providerEvents'
  >,
): DiagramCollaborationProviderLifecycle {
  const providerEvents = new DiagramCollaborationProviderEvents({
    storeBridge: options.storeBridge,
    dispatchRuntimeEvent: options.dispatchRuntimeEvent,
    handoffLogPrefix: options.handoffLogPrefix,
    handoffStartedAt: options.handoffStartedAt,
  });
  const previewHydrationController = new DiagramPreviewHydrationController({
    ydoc: options.ydoc,
    bootstrap: options.bootstrap,
    previewEnabled: options.previewEnabled,
    fallbackTimeoutMs: options.fallbackTimeoutMs,
    handoffStartedAt: options.handoffStartedAt,
    handoffLogPrefix: options.handoffLogPrefix,
    documentAdapter: options.documentAdapter,
    dispatchRuntimeEvent: options.dispatchRuntimeEvent,
    updatePreviewMode: options.updatePreviewMode,
    loadPreview: options.storeBridge.loadPreview,
    getConnectionStatus: providerEvents.getConnectionStatus,
  });
  const providerBinding = new DiagramCollaborationProviderBinding(
    providerEvents.createBindingCallbacks((wsConnectedAt) => {
      previewHydrationController.onConnected(wsConnectedAt);
    }),
  );

  return new DiagramCollaborationProviderLifecycle(options, {
    ...dependencies,
    previewHydrationController,
    providerBinding,
    providerEvents,
  });
}
