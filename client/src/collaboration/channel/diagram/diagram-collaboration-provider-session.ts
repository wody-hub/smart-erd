import * as Y from 'yjs';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import type { CreateDiagramCollaborationProviderLifecycle } from './use-diagram-collaboration-runtime.js';

interface DiagramCollaborationProviderSessionOptions {
  collaborationBootstrap: DiagramCollaborationBootstrap;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  initYDoc: (doc: Y.Doc) => void;
  destroyYDoc: () => void;
  resetCollaboration: () => void;
  resetRuntimeState: () => void;
  createProviderLifecycle: CreateDiagramCollaborationProviderLifecycle;
  updatePreviewMode: (next: boolean) => void;
  onProviderReady: (provider: YjsProvider) => void;
  onProviderDisposed: () => void;
}

/**
 * 다이어그램 협업의 Y.Doc/provider 생성과 cleanup을 한 세션 단위로 캡슐화한다.
 */
export class DiagramCollaborationProviderSession {
  private providerLifecycle: ReturnType<CreateDiagramCollaborationProviderLifecycle> | null = null;

  constructor(
    private readonly options: DiagramCollaborationProviderSessionOptions,
  ) {}

  async setup(): Promise<void> {
    const ydoc = new Y.Doc();
    this.options.initYDoc(ydoc);
    this.providerLifecycle = this.options.createProviderLifecycle({
      ydoc,
      diagramId: this.options.diagramId,
      teamId: this.options.teamId,
      projectId: this.options.projectId,
      updatePreviewMode: this.options.updatePreviewMode,
      onProviderReady: this.options.onProviderReady,
      onProviderDisposed: this.options.onProviderDisposed,
    });
    await this.providerLifecycle.setup();
  }

  dispose(): void {
    this.options.resetRuntimeState();
    this.providerLifecycle?.dispose();
    this.providerLifecycle = null;
    this.options.destroyYDoc();
    this.options.resetCollaboration();
  }
}
