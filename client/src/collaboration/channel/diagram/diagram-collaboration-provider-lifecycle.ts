import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import type { CollaborationRuntimeEvent } from '@/collaboration/core/collaboration-runtime-types';
import type {
  AwarenessState,
  ConnectionStatus,
  PresenceMode,
  PresencePeerJoinedPayload,
  PresencePeerLeftPayload,
  PresenceSnapshotPayload,
} from '@/types/collaboration';
import { DiagramCollaborationProviderBinding } from '@/collaboration/channel/diagram/diagram-collaboration-provider-binding';
import { DiagramPreviewHydrationController } from '@/collaboration/channel/diagram/diagram-preview-hydration-controller';
import { DiagramCollaborationTransport } from '@/collaboration/channel/diagram/diagram-collaboration-transport';
import { DiagramContentOnlySnapshotSeeder } from '@/collaboration/channel/diagram/diagram-content-only-snapshot-seeder';
import type { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';

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
  loadPreview: (content: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setPresenceMode: (mode: PresenceMode) => void;
  setSelfUserId: (userId: string) => void;
  applyPresenceSnapshot: (payload: PresenceSnapshotPayload) => void;
  applyPeerJoined: (payload: PresencePeerJoinedPayload) => void;
  applyPeerLeft: (payload: PresencePeerLeftPayload) => void;
  updateAwareness: (clientId: number, state: AwarenessState | null) => void;
  removePeerByUserId: (userId: string) => void;
  removePeerByLoginId: (loginId: string) => void;
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

  private provider: YjsProvider | null = null;

  private isDisposed = false;

  private currentConnectionStatus: ConnectionStatus = 'connecting';

  private ticketRequestedAt: number | null = null;

  private wsConnectedAt: number | null = null;

  constructor(
    private readonly options: DiagramCollaborationProviderLifecycleOptions,
  ) {
    this.contentOnlySnapshotSeeder = new DiagramContentOnlySnapshotSeeder(options.documentAdapter);
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
      loadPreview: options.loadPreview,
      getConnectionStatus: () => this.currentConnectionStatus,
    });
    this.providerBinding = new DiagramCollaborationProviderBinding({
      onConnectionStatusChange: (status) => {
        this.currentConnectionStatus = status;
        this.options.setConnectionStatus(status);
        if (status === 'connecting' && this.wsConnectedAt !== null) {
          this.options.dispatchRuntimeEvent('reconnect-start');
        }
        if (status === 'disconnected') {
          this.options.dispatchRuntimeEvent('disconnect');
        }
        if (status === 'connected') {
          this.options.dispatchRuntimeEvent('ws-connected');
          this.wsConnectedAt = performance.now();
          console.info(
            '%s ws-connected totalMs=%d afterTicketMs=%s',
            this.options.handoffLogPrefix,
            Math.round(this.wsConnectedAt - this.options.handoffStartedAt),
            this.ticketRequestedAt === null ? 'n/a' : Math.round(this.wsConnectedAt - this.ticketRequestedAt),
          );
          this.previewHydrationController.onConnected(this.wsConnectedAt);
        }
      },
      onIdentityResolved: (userId) => {
        this.options.setSelfUserId(userId);
      },
      onPresenceModeChange: (mode) => {
        this.options.setPresenceMode(mode);
      },
      onPresenceSnapshot: (payload) => {
        this.options.applyPresenceSnapshot(payload);
      },
      onPresencePeerJoined: (payload) => {
        this.options.applyPeerJoined(payload);
      },
      onPresencePeerLeft: (payload) => {
        this.options.applyPeerLeft(payload);
        this.options.removePeerByUserId(payload.userId);
      },
      onAwarenessReceived: (clientId, state) => {
        this.options.updateAwareness(clientId, state);
      },
      onPeerLeft: (loginId) => {
        this.options.removePeerByLoginId(loginId);
      },
    });
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
        this.ticketRequestedAt = performance.now();
        const ticket = await this.transport.issueTicket(this.options.diagramId);
        const ticketResolvedAt = performance.now();
        console.info(
          '%s ticket-issued ms=%d totalMs=%d',
          this.options.handoffLogPrefix,
          Math.round(ticketResolvedAt - this.ticketRequestedAt),
          Math.round(ticketResolvedAt - this.options.handoffStartedAt),
        );
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
