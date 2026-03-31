import {
  type DocumentChangeEvent,
  type DocumentReadContextFactory,
  type DocumentMutationApplyResult,
  type DocumentMutation,
  type DocumentMutationPort,
  type DocumentReadExecutor,
  type DocumentReadQuery,
  type DocumentSubscriptionPort,
  type MutationMeta,
  type ScopeRef,
} from '@/collaboration/core/contracts/document-read-executor';
import type { SharedDocumentEngineUpdate } from '@/collaboration/core/contracts/shared-document-engine';
import { resolveDocumentChangeOrigin } from '@/collaboration/core/store/document-change-origin';
import type { DocumentRevisionSubscriptionSource } from '@/collaboration/core/store/document-revision-tracker';

export interface DocumentMutationApplier {
  apply<T = unknown>(mutation: DocumentMutation): DocumentMutationApplyResult<T>;
}

export type DocumentUpdateScopeResolver = (update: SharedDocumentEngineUpdate) => ScopeRef[];

interface PendingMutationEvent {
  origin: MutationMeta['origin'];
  affectedScopes: DocumentMutation['affectedScopes'];
}

/**
 * Phase 1 Slice 2용 최소 DocumentStore.
 *
 * 현재는 ERD mutation 일부만 처리하고, shared engine에 반영한 뒤 change event를 발행한다.
 */
export class DocumentStore
  implements DocumentMutationPort, DocumentSubscriptionPort, DocumentReadExecutor
{
  private readonly listeners = new Set<(event: DocumentChangeEvent) => void>();
  private unsubscribeRevision: (() => void) | null = null;
  private pendingMutationEvent: PendingMutationEvent | null = null;

  constructor(
    private readonly mutationApplier: DocumentMutationApplier,
    private readonly revisionSource: DocumentRevisionSubscriptionSource,
    private readonly readContextFactory: DocumentReadContextFactory,
    private readonly exportSnapshotDelegate: () => Uint8Array,
    private readonly resolveAffectedScopes: DocumentUpdateScopeResolver,
  ) {}

  attach(): void {
    if (this.unsubscribeRevision) {
      return;
    }
    this.unsubscribeRevision = this.revisionSource.subscribe((revision, update) => {
      this.handleRevisionChanged(revision, update);
    });
  }

  dispose(): void {
    this.unsubscribeRevision?.();
    this.unsubscribeRevision = null;
    this.pendingMutationEvent = null;
  }

  applyMutation<T = unknown>(
    mutation: DocumentMutation,
    meta: MutationMeta,
  ): DocumentMutationApplyResult<T> {
    const previousRevision = this.revisionSource.getRevision();
    this.pendingMutationEvent = {
      origin: meta.origin,
      affectedScopes: mutation.affectedScopes,
    };
    const result = this.mutationApplier.apply<T>(mutation);
    if (!result.applied) {
      this.pendingMutationEvent = null;
      return result;
    }

    const nextRevision = this.revisionSource.getRevision();
    if (nextRevision === previousRevision) {
      this.pendingMutationEvent = null;
    }
    return result;
  }

  subscribe(listener: (event: DocumentChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getRevision(): string {
    return this.revisionSource.getRevision();
  }

  execute<T>(query: DocumentReadQuery<T>): T {
    return query.run(this.readContextFactory.create());
  }

  exportSnapshot(): Uint8Array {
    return this.exportSnapshotDelegate();
  }

  private handleRevisionChanged(revision: string, update: SharedDocumentEngineUpdate): void {
    const resolvedOrigin = resolveDocumentChangeOrigin(update.origin);
    if (resolvedOrigin.source === 'bootstrap') {
      this.pendingMutationEvent = null;
      return;
    }

    const pendingMutationEvent =
      resolvedOrigin.source !== 'remote' ? this.pendingMutationEvent : null;
    if (pendingMutationEvent) {
      this.pendingMutationEvent = null;
    }

    const event: DocumentChangeEvent = {
      revision,
      origin: pendingMutationEvent?.origin ?? resolvedOrigin,
      engineOrigin: resolvedOrigin,
      affectedScopes: pendingMutationEvent?.affectedScopes ?? this.resolveAffectedScopes(update),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
