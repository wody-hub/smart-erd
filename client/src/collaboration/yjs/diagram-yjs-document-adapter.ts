import * as Y from 'yjs';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';
import { migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import type { YjsDocumentAdapter } from './yjs-document-adapter.js';

/**
 * 다이어그램 bootstrap/Y.Doc 변환 어댑터.
 */
export class DiagramYjsDocumentAdapter implements YjsDocumentAdapter<DiagramCollaborationBootstrap> {
  /**
   * {@inheritDoc}
   */
  applyBootstrapToDoc(doc: Y.Doc, bootstrap: DiagramCollaborationBootstrap): void {
    if (!bootstrap.content) {
      return;
    }
    migrateJsonToYDoc(doc, bootstrap.content);
  }

  /**
   * {@inheritDoc}
   */
  extractFullStateUpdate(doc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(doc);
  }
}
