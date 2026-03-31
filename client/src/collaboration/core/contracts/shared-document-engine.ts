export interface SharedDocumentEngineUpdate {
  origin: unknown;
  changeSet?: unknown;
}

export interface SharedDocumentEngine {
  engineId: string;
  hydrate(snapshot: Uint8Array): void;
  exportSnapshot(): Uint8Array;
  applyRemoteDelta(delta: Uint8Array): void;
  subscribeUpdates(listener: (update: SharedDocumentEngineUpdate) => void): () => void;
}
