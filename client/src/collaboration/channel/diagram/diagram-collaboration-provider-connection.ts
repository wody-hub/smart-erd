import * as Y from 'yjs';

export interface DiagramCollaborationProviderLike {
  connect(): void;
  destroy(): void;
}

export interface DiagramCollaborationProviderConnectOptions<TTicket = unknown> {
  diagramId: string;
  websocketPath: string;
  getTicket: () => Promise<TTicket>;
}

interface DiagramCollaborationProviderConnectionOptions<
  TProvider extends DiagramCollaborationProviderLike,
> {
  ydoc: Y.Doc;
  diagramId: string;
  onProviderReady: (provider: TProvider) => void;
  onProviderDisposed: () => void;
}

interface DiagramCollaborationProviderTransport<TTicket> {
  websocketPath(diagramId: string): string;
  issueTicket(diagramId: string): Promise<TTicket>;
}

interface DiagramCollaborationProviderBindingPort {
  bind(provider: DiagramCollaborationProviderLike): void;
  dispose(provider: DiagramCollaborationProviderLike | null): void;
}

interface DiagramCollaborationProviderEventsPort {
  markTicketRequested(): void;
  logTicketIssued(): void;
}

interface DiagramCollaborationProviderConnectionDependencies<
  TProvider extends DiagramCollaborationProviderLike,
  TTicket,
> {
  transport: DiagramCollaborationProviderTransport<TTicket>;
  providerBinding: DiagramCollaborationProviderBindingPort;
  providerEvents: DiagramCollaborationProviderEventsPort;
  createProvider: (
    doc: Y.Doc,
    options: DiagramCollaborationProviderConnectOptions<TTicket>,
  ) => TProvider;
}

/**
 * YjsProvider 생성, binding, connect/dispose를 캡슐화한다.
 */
export class DiagramCollaborationProviderConnection<
  TProvider extends DiagramCollaborationProviderLike = DiagramCollaborationProviderLike,
  TTicket = unknown,
> {
  private provider: TProvider | null = null;

  constructor(
    private readonly options: DiagramCollaborationProviderConnectionOptions<TProvider>,
    private readonly dependencies: DiagramCollaborationProviderConnectionDependencies<
      TProvider,
      TTicket
    >,
  ) {}

  connect(): void {
    if (this.provider) {
      throw new Error(
        'DiagramCollaborationProviderConnection.connect() called twice without dispose()',
      );
    }

    const { transport, providerBinding, providerEvents } = this.dependencies;
    const provider = this.dependencies.createProvider(this.options.ydoc, {
      diagramId: this.options.diagramId,
      websocketPath: transport.websocketPath(this.options.diagramId),
      getTicket: async () => {
        providerEvents.markTicketRequested();
        const ticket = await transport.issueTicket(this.options.diagramId);
        providerEvents.logTicketIssued();
        return ticket;
      },
    });
    this.provider = provider;

    providerBinding.bind(provider);
    provider.connect();
    this.options.onProviderReady(provider);
  }

  dispose(): void {
    const provider = this.provider;
    try {
      this.dependencies.providerBinding.dispose(provider);
      provider?.destroy();
    } catch (error) {
      console.error('[useDiagramCollaborationSession] provider.destroy() 실패:', error);
    } finally {
      this.provider = null;
      this.options.onProviderDisposed();
    }
  }
}
