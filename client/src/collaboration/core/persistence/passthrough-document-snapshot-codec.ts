import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';

/**
 * Yjs update를 그대로 persistence payload로 사용하는 기본 codec.
 *
 * snapshot 포맷 변환이 아직 필요하지 않은 Phase 1에서 사용한다.
 */
export class PassthroughDocumentSnapshotCodec implements DocumentSnapshotCodec {
  readonly snapshotFormatVersion = 1;

  decodeToSnapshot(persisted: Uint8Array): Uint8Array {
    return persisted;
  }

  encodeForPersistence(inMemorySnapshot: Uint8Array): Uint8Array {
    return inMemorySnapshot;
  }
}
