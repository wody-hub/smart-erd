import type { SharedDocumentEngineUpdate } from '@/collaboration/core/contracts/shared-document-engine';

export interface DocumentRevisionSource {
  getRevision(): string;
}

export interface DocumentRevisionSubscriptionSource extends DocumentRevisionSource {
  subscribe(listener: (revision: string, update: SharedDocumentEngineUpdate) => void): () => void;
}

/**
 * shared document update를 기준으로 문서 revision을 단일 축으로 유지한다.
 *
 * Phase 1에서는 bootstrap revision을 시작점으로 삼고,
 * engine update가 발생할 때마다 클라이언트 내부 monotonic revision을 증가시킨다.
 */
export class DocumentRevisionTracker implements DocumentRevisionSubscriptionSource {
  private revision: string;
  private readonly listeners = new Set<
    (revision: string, update: SharedDocumentEngineUpdate) => void
  >();

  constructor(initialRevision = '0') {
    this.revision = initialRevision;
  }

  getRevision(): string {
    return this.revision;
  }

  subscribe(listener: (revision: string, update: SharedDocumentEngineUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  handleDocumentUpdated(update: SharedDocumentEngineUpdate): void {
    if (update.origin === 'bootstrap') {
      return;
    }

    this.revision = `${BigInt(this.revision) + 1n}`;
    for (const listener of this.listeners) {
      listener(this.revision, update);
    }
  }
}
