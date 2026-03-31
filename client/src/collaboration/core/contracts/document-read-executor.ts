export type ScopeLockMode = 'shared' | 'exclusive';

export interface ScopeRef {
  kind: string;
  id: string;
  mode: ScopeLockMode;
}

export interface DocumentEntityRef {
  kind: string;
  id: string;
}

export interface DocumentEntity {
  ref: DocumentEntityRef;
  props: Record<string, unknown>;
}

export interface DocumentReadContext {
  getEntity(ref: DocumentEntityRef): DocumentEntity | null;
  listRelated(ref: DocumentEntityRef, relation: string): DocumentEntityRef[];
  getProperty(ref: DocumentEntityRef, key: string): unknown;
  findByKind(kind: string): DocumentEntityRef[];
  getRevision(): string;
}

export interface DocumentReadQuery<T> {
  run(context: DocumentReadContext): T;
}

export interface DocumentReadContextFactory {
  create(): DocumentReadContext;
}

export interface DocumentReadExecutor {
  getRevision(): string;
  execute<T>(query: DocumentReadQuery<T>): T;
  exportSnapshot(): Uint8Array;
}

export interface DocumentChangeOrigin {
  source: 'local' | 'remote' | 'bootstrap' | 'system';
  requestId?: string;
  clientId?: string;
}

export interface MutationMeta {
  origin: DocumentChangeOrigin;
  requestId?: string;
}

export interface DocumentMutation {
  key: string;
  payload?: Record<string, unknown>;
  affectedScopes: ScopeRef[];
}

export interface DocumentMutationApplyResult<T = unknown> {
  applied: boolean;
  value?: T;
}

export interface DocumentChangeEvent {
  revision: string;
  origin: DocumentChangeOrigin;
  engineOrigin: DocumentChangeOrigin;
  affectedScopes: ScopeRef[];
}

export interface DocumentMutationPort {
  applyMutation<T = unknown>(
    mutation: DocumentMutation,
    meta: MutationMeta,
  ): DocumentMutationApplyResult<T>;
}

export interface DocumentSubscriptionPort {
  subscribe(listener: (event: DocumentChangeEvent) => void): () => void;
}
