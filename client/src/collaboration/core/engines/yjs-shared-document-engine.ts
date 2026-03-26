import * as Y from 'yjs';
import type {
  SharedDocumentEngine,
  SharedDocumentEngineUpdate,
} from '@/collaboration/core/contracts/shared-document-engine';
export const YJS_SHARED_DOCUMENT_ENGINE_ID = 'yjs';

/**
 * Yjs 기반 shared document engine 최소 구현.
 *
 * 현재 단계에서는 기존 diagram channel이 사용하던 Y.Doc lifecycle을 감싸는 역할만 담당한다.
 */
export class YjsSharedDocumentEngine implements SharedDocumentEngine {
  readonly engineId = YJS_SHARED_DOCUMENT_ENGINE_ID;

  constructor(private readonly doc: Y.Doc = new Y.Doc()) {}

  hydrate(snapshot: Uint8Array): void {
    Y.applyUpdate(this.doc, snapshot, 'bootstrap');
  }

  exportSnapshot(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyRemoteDelta(delta: Uint8Array): void {
    Y.applyUpdate(this.doc, delta, 'remote');
  }

  subscribeUpdates(listener: (update: SharedDocumentEngineUpdate) => void): () => void {
    const handleAfterTransaction = (transaction: Y.Transaction) => {
      listener({
        origin: transaction.origin,
        changeSet: transaction,
      });
    };
    this.doc.on('afterTransaction', handleAfterTransaction);
    return () => {
      this.doc.off('afterTransaction', handleAfterTransaction);
    };
  }

  getDocument(): Y.Doc {
    return this.doc;
  }
}
