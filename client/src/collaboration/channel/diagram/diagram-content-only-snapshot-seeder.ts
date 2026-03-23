import * as Y from 'yjs';
import { persistDiagramYdocSnapshot } from '@/api/diagramApi';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';
import { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';

export type DiagramContentOnlySnapshotSeedResult =
  | 'skipped'
  | 'persisted'
  | 'not-persisted';

interface SeedContentOnlySnapshotParams {
  bootstrap: DiagramCollaborationBootstrap;
  diagramId: string;
  teamId?: string;
  projectId?: string;
  doc: Y.Doc;
}

/**
 * content-only 다이어그램의 persisted snapshot 선제 저장 정책.
 */
export class DiagramContentOnlySnapshotSeeder {
  constructor(
    private readonly documentAdapter: DiagramYjsDocumentAdapter,
  ) {}

  /**
   * content-only 다이어그램이면 Y.Doc 기반 persisted snapshot을 선제 저장한다.
   */
  async seed(
    params: SeedContentOnlySnapshotParams,
  ): Promise<DiagramContentOnlySnapshotSeedResult> {
    const {
      bootstrap,
      diagramId,
      teamId,
      projectId,
      doc,
    } = params;

    if (!bootstrap.content || bootstrap.hasYdocSnapshot || !teamId || !projectId) {
      return 'skipped';
    }

    this.documentAdapter.applyBootstrapToDoc(doc, bootstrap);
    const persisted = await persistDiagramYdocSnapshot(
      teamId,
      projectId,
      diagramId,
      bootstrap.contentRevision,
      this.documentAdapter.extractFullStateUpdate(doc),
    );
    return persisted ? 'persisted' : 'not-persisted';
  }
}
