import type { CollaborationRuntimeEvent } from '../../core/collaboration-runtime-types.js';
import type { DiagramCollaborationProviderBindingCallbacks } from './diagram-collaboration-provider-callbacks.js';
import type { DiagramCollaborationStoreBridge } from './diagram-collaboration-store-bridge.js';
import type { ConnectionStatus } from '../../../types/collaboration.js';

interface DiagramCollaborationProviderEventsOptions {
  storeBridge: DiagramCollaborationStoreBridge;
  dispatchRuntimeEvent: (event: CollaborationRuntimeEvent) => void;
  handoffLogPrefix: string;
  handoffStartedAt: number;
}

/**
 * provider 이벤트의 store 반영, runtime 전이, handoff 로그를 한곳에서 관리한다.
 */
export class DiagramCollaborationProviderEvents {
  private currentConnectionStatus: ConnectionStatus = 'connecting';

  private ticketRequestedAt: number | null = null;

  private wsConnectedAt: number | null = null;

  constructor(
    private readonly options: DiagramCollaborationProviderEventsOptions,
  ) {}

  getConnectionStatus = (): ConnectionStatus => this.currentConnectionStatus;

  markTicketRequested(): void {
    this.ticketRequestedAt = performance.now();
  }

  logTicketIssued(): void {
    const ticketResolvedAt = performance.now();
    console.info(
      '%s ticket-issued ms=%d totalMs=%d',
      this.options.handoffLogPrefix,
      Math.round(ticketResolvedAt - (this.ticketRequestedAt ?? ticketResolvedAt)),
      Math.round(ticketResolvedAt - this.options.handoffStartedAt),
    );
  }

  createBindingCallbacks(
    onConnected: (wsConnectedAt: number) => void,
  ): DiagramCollaborationProviderBindingCallbacks {
    return {
      onConnectionStatusChange: (status) => {
        this.currentConnectionStatus = status;
        this.options.storeBridge.setConnectionStatus(status);
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
          onConnected(this.wsConnectedAt);
        }
      },
      onIdentityResolved: (userId) => {
        this.options.storeBridge.setSelfUserId(userId);
      },
      onPresenceModeChange: (mode) => {
        this.options.storeBridge.setPresenceMode(mode);
      },
      onPresenceSnapshot: (payload) => {
        this.options.storeBridge.applyPresenceSnapshot(payload);
      },
      onPresencePeerJoined: (payload) => {
        this.options.storeBridge.applyPeerJoined(payload);
      },
      onPresencePeerLeft: (payload) => {
        this.options.storeBridge.applyPeerLeft(payload);
        this.options.storeBridge.removePeerByUserId(payload.userId);
      },
      onAwarenessReceived: (clientId, state) => {
        this.options.storeBridge.updateAwareness(clientId, state);
      },
      onPeerLeft: (loginId) => {
        this.options.storeBridge.removePeerByLoginId(loginId);
      },
    };
  }
}
