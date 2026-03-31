import * as Y from 'yjs';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';
import { migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import type { YjsDocumentAdapter } from './yjs-document-adapter.js';

export const DIAGRAM_BOOTSTRAP_TRANSACTION_ORIGIN = 'bootstrap';

/**
 * 다이어그램 bootstrap/Y.Doc 변환 어댑터.
 */
export class DiagramYjsDocumentAdapter implements YjsDocumentAdapter<DiagramCollaborationBootstrap> {
  /**
   * {@inheritDoc}
   */
  applyBootstrapToDoc(
    doc: Y.Doc,
    bootstrap: DiagramCollaborationBootstrap,
    origin: unknown,
  ): void {
    if (!bootstrap.content) {
      return;
    }
    migrateJsonToYDoc(doc, bootstrap.content, origin);
  }

  /**
   * {@inheritDoc}
   */
  extractFullStateUpdate(doc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(doc);
  }
}
