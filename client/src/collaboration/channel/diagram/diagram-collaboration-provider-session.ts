import type * as Y from 'yjs';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import type {
  CreateDiagramCollaborationProviderLifecycle,
  DiagramCollaborationProviderLifecycleLike,
} from './diagram-collaboration-provider-factory.js';
import type { DiagramCollaborationProviderLike } from './diagram-collaboration-provider-connection.js';

interface DiagramCollaborationProviderSessionOptions {
  collaborationBootstrap: DiagramCollaborationBootstrap;
  sharedDocumentEngine: YjsSharedDocumentEngine;
  snapshotCodec: DocumentSnapshotCodec;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  initYDoc: (doc: Y.Doc) => void;
  destroyYDoc: () => void;
  resetCollaboration: () => void;
  resetRuntimeState: () => void;
  beforeDestroyYDoc?: (() => void) | null;
  createProviderLifecycle: CreateDiagramCollaborationProviderLifecycle;
  updatePreviewMode: (next: boolean) => void;
  onProviderReady: (provider: DiagramCollaborationProviderLike) => void;
  onProviderDisposed: () => void;
}

/**
 * 다이어그램 협업의 Y.Doc/provider 생성과 cleanup을 한 세션 단위로 캡슐화한다.
 */
export class DiagramCollaborationProviderSession {
  private providerLifecycle: DiagramCollaborationProviderLifecycleLike | null = null;

  private isDisposed = false;

  private hasCleanedUp = false;

  constructor(private readonly options: DiagramCollaborationProviderSessionOptions) {}

  async setup(): Promise<void> {
    const ydoc = this.options.sharedDocumentEngine.getDocument();
    this.options.initYDoc(ydoc);
    try {
      if (this.isDisposed) {
        this.cleanup();
        return;
      }

      this.providerLifecycle = this.options.createProviderLifecycle({
        ydoc,
        sharedDocumentEngine: this.options.sharedDocumentEngine,
        snapshotCodec: this.options.snapshotCodec,
        diagramId: this.options.diagramId,
        teamId: this.options.teamId,
        projectId: this.options.projectId,
        updatePreviewMode: this.options.updatePreviewMode,
        onProviderReady: this.options.onProviderReady,
        onProviderDisposed: this.options.onProviderDisposed,
      });

      await this.providerLifecycle.setup();

      if (this.isDisposed) {
        this.cleanup();
      }
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  dispose(): void {
    this.isDisposed = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.hasCleanedUp) {
      return;
    }
    this.hasCleanedUp = true;
    // 준비 상태가 내려가기 전에 초안을 flush하고 체크포인트 저장 요청을 시작한다.
    try {
      this.options.beforeDestroyYDoc?.();
    } finally {
      this.providerLifecycle?.dispose();
      this.providerLifecycle = null;
      this.options.resetRuntimeState();
      this.options.destroyYDoc();
      this.options.resetCollaboration();
    }
  }
}
