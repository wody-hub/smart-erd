export interface DocumentSnapshotCodec {
  snapshotFormatVersion: number;
  decodeToSnapshot(persisted: Uint8Array): Uint8Array;
  encodeForPersistence(inMemorySnapshot: Uint8Array): Uint8Array;
}
