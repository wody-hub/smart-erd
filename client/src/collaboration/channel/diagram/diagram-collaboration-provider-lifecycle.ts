import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import type { CollaborationRuntimeEvent } from '@/collaboration/core/collaboration-runtime-types';
import { DiagramCollaborationProviderBinding } from './diagram-collaboration-provider-binding.js';
import { DiagramPreviewHydrationController } from './diagram-preview-hydration-controller.js';
import { DiagramCollaborationTransport } from './diagram-collaboration-transport.js';
import { DiagramContentOnlySnapshotSeeder } from './diagram-content-only-snapshot-seeder.js';
import { DiagramCollaborationProviderEvents } from './diagram-collaboration-provider-events.js';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';
import type { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';

interface DiagramCollaborationProviderLifecycleOptions {
  ydoc: Y.Doc;
  bootstrap: DiagramCollaborationBootstrap;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  previewEnabled: boolean;
  fallbackTimeoutMs: number;
  handoffStartedAt: number;
  handoffLogPrefix: string;
  documentAdapter: DiagramYjsDocumentAdapter;
  dispatchRuntimeEvent: (event: CollaborationRuntimeEvent) => void;
  updatePreviewMode: (next: boolean) => void;
  storeBridge: DiagramCollaborationStoreBridge;
  onProviderReady: (provider: YjsProvider) => void;
  onProviderDisposed: () => void;
}

/**
 * 다이어그램 채널의 YjsProvider 생성/연결/정리 수명주기를 캡슐화한다.
 */
export class DiagramCollaborationProviderLifecycle {
  private readonly transport = new DiagramCollaborationTransport();

  private readonly contentOnlySnapshotSeeder: DiagramContentOnlySnapshotSeeder;

  private readonly previewHydrationController: DiagramPreviewHydrationController;

  private readonly providerBinding: DiagramCollaborationProviderBinding;

  private readonly providerEvents: DiagramCollaborationProviderEvents;

  private provider: YjsProvider | null = null;

  private isDisposed = false;

  constructor(
    private readonly options: DiagramCollaborationProviderLifecycleOptions,
  ) {
    this.contentOnlySnapshotSeeder = new DiagramContentOnlySnapshotSeeder(options.documentAdapter);
    this.providerEvents = new DiagramCollaborationProviderEvents({
      storeBridge: options.storeBridge,
      dispatchRuntimeEvent: options.dispatchRuntimeEvent,
      handoffLogPrefix: options.handoffLogPrefix,
      handoffStartedAt: options.handoffStartedAt,
    });
    this.previewHydrationController = new DiagramPreviewHydrationController({
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
      getConnectionStatus: this.providerEvents.getConnectionStatus,
    });
    this.providerBinding = new DiagramCollaborationProviderBinding(
      this.providerEvents.createBindingCallbacks((wsConnectedAt) => {
        this.previewHydrationController.onConnected(wsConnectedAt);
      }),
    );
  }

  /**
   * content-only seed, preview hydration, provider 연결을 순서대로 수행한다.
   */
  async setup(): Promise<void> {
    try {
      const seedResult = await this.contentOnlySnapshotSeeder.seed({
        bootstrap: this.options.bootstrap,
        diagramId: this.options.diagramId,
        teamId: this.options.teamId,
        projectId: this.options.projectId,
        doc: this.options.ydoc,
      });
      if (seedResult === 'persisted') {
        console.info(
          '%s content-only snapshot-seeded totalMs=%d',
          this.options.handoffLogPrefix,
          Math.round(performance.now() - this.options.handoffStartedAt),
        );
      } else if (seedResult === 'not-persisted') {
        console.warn('%s content-only snapshot seed returned persisted=false', this.options.handoffLogPrefix);
      }
    } catch (error) {
      if (this.options.bootstrap.content && !this.options.bootstrap.hasYdocSnapshot) {
        console.warn('%s content-only snapshot seed failed', this.options.handoffLogPrefix, error);
      }
    }

    if (this.isDisposed) {
      return;
    }

    this.previewHydrationController.start();

    this.provider = new YjsProvider(this.options.ydoc, {
      diagramId: this.options.diagramId,
      websocketPath: this.transport.websocketPath(this.options.diagramId),
      getTicket: async () => {
        this.providerEvents.markTicketRequested();
        const ticket = await this.transport.issueTicket(this.options.diagramId);
        this.providerEvents.logTicketIssued();
        return ticket;
      },
    });

    this.providerBinding.bind(this.provider);
    this.provider.connect();
    this.options.onProviderReady(this.provider);
  }

  /**
   * preview observer, provider binding, provider를 정리한다.
   */
  dispose(): void {
    this.isDisposed = true;
    this.previewHydrationController.dispose();
    try {
      this.provider?.destroy();
    } catch (error) {
      console.error('[useYjsCollaboration] provider.destroy() 실패:', error);
    } finally {
      this.providerBinding.dispose(this.provider);
      this.provider = null;
      this.options.onProviderDisposed();
    }
  }
}
