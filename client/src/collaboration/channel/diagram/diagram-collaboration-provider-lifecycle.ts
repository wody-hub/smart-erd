import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { DiagramCollaborationProviderBinding } from './diagram-collaboration-provider-binding.js';
import { DiagramPreviewHydrationController } from './diagram-preview-hydration-controller.js';
import { DiagramCollaborationTransport } from './diagram-collaboration-transport.js';
import { DiagramContentOnlySnapshotSeeder } from './diagram-content-only-snapshot-seeder.js';
import { DiagramCollaborationProviderEvents } from './diagram-collaboration-provider-events.js';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';

interface DiagramCollaborationProviderLifecycleOptions {
  ydoc: Y.Doc;
  bootstrap: DiagramCollaborationBootstrap;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  handoffStartedAt: number;
  handoffLogPrefix: string;
  onProviderReady: (provider: YjsProvider) => void;
  onProviderDisposed: () => void;
}

export interface DiagramCollaborationProviderLifecycleDependencies {
  transport: DiagramCollaborationTransport;
  contentOnlySnapshotSeeder: DiagramContentOnlySnapshotSeeder;
  previewHydrationController: DiagramPreviewHydrationController;
  providerBinding: DiagramCollaborationProviderBinding;
  providerEvents: DiagramCollaborationProviderEvents;
}

/**
 * 다이어그램 채널의 YjsProvider 생성/연결/정리 수명주기를 캡슐화한다.
 */
export class DiagramCollaborationProviderLifecycle {
  private provider: YjsProvider | null = null;

  private isDisposed = false;

  constructor(
    private readonly options: DiagramCollaborationProviderLifecycleOptions,
    private readonly dependencies: DiagramCollaborationProviderLifecycleDependencies,
  ) {}

  /**
   * content-only seed, preview hydration, provider 연결을 순서대로 수행한다.
   */
  async setup(): Promise<void> {
    const { contentOnlySnapshotSeeder, previewHydrationController, transport, providerBinding, providerEvents } =
      this.dependencies;
    try {
      const seedResult = await contentOnlySnapshotSeeder.seed({
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

    previewHydrationController.start();

    this.provider = new YjsProvider(this.options.ydoc, {
      diagramId: this.options.diagramId,
      websocketPath: transport.websocketPath(this.options.diagramId),
      getTicket: async () => {
        providerEvents.markTicketRequested();
        const ticket = await transport.issueTicket(this.options.diagramId);
        providerEvents.logTicketIssued();
        return ticket;
      },
    });

    providerBinding.bind(this.provider);
    this.provider.connect();
    this.options.onProviderReady(this.provider);
  }

  /**
   * preview observer, provider binding, provider를 정리한다.
   */
  dispose(): void {
    this.isDisposed = true;
    this.dependencies.previewHydrationController.dispose();
    try {
      this.provider?.destroy();
    } catch (error) {
      console.error('[useYjsCollaboration] provider.destroy() 실패:', error);
    } finally {
      this.dependencies.providerBinding.dispose(this.provider);
      this.provider = null;
      this.options.onProviderDisposed();
    }
  }
}
