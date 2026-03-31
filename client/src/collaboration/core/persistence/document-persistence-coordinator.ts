import type { CompatibilityArtifactSerializer } from '@/collaboration/core/contracts/document-plugin';
import type {
  DocumentCheckpoint,
  DocumentCheckpointReader,
} from '@/collaboration/core/contracts/document-checkpoint';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { DocumentRevisionSubscriptionSource } from '@/collaboration/core/store/document-revision-tracker';

const DEFAULT_CHECKPOINT_IDLE_MS = 350;

export interface DocumentPersistenceMetadata {
  documentId: number;
  pluginId: string;
  engineId: string;
  pluginSchemaVersion: number;
}

interface DocumentPersistenceCoordinatorOptions {
  metadata: DocumentPersistenceMetadata;
  revisionSource: DocumentRevisionSubscriptionSource;
  snapshotCodec: DocumentSnapshotCodec;
  exportSnapshot: () => Uint8Array;
  artifactSerializer?: CompatibilityArtifactSerializer | null;
  scheduleDelayMs?: number;
}

function cloneBytes(value: Uint8Array | null): Uint8Array | null {
  return value ? value.slice() : null;
}

function cloneCheckpoint(checkpoint: DocumentCheckpoint): DocumentCheckpoint {
  return {
    ...checkpoint,
    snapshot: checkpoint.snapshot.slice(),
    compatibilityArtifact: cloneBytes(checkpoint.compatibilityArtifact),
  };
}

/**
 * Phase 1 최소 persisted checkpoint coordinator.
 *
 * 아직 일부 legacy 경로가 Y.Doc을 직접 수정하므로,
 * DocumentStore 대신 shared engine 변경원을 구독해 snapshot cache를 유지한다.
 */
export class DocumentPersistenceCoordinator implements DocumentCheckpointReader {
  private builtRevision: string | null = null;
  private cachedCheckpoint: DocumentCheckpoint | null = null;
  private buildTimer: ReturnType<typeof setTimeout> | null = null;
  private idleHandle: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly options: DocumentPersistenceCoordinatorOptions) {}

  getRevision(): string {
    return this.options.revisionSource.getRevision();
  }

  getLatestCheckpoint(): DocumentCheckpoint {
    const currentRevision = this.options.revisionSource.getRevision();
    if (this.cachedCheckpoint && this.builtRevision === currentRevision) {
      return cloneCheckpoint(this.cachedCheckpoint);
    }
    return cloneCheckpoint(this.buildCheckpoint());
  }

  attach(): void {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = this.options.revisionSource.subscribe(() => {
      this.handleSourceChanged();
    });
    this.scheduleCheckpointBuild();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clearScheduledBuild();
    this.cachedCheckpoint = null;
    this.builtRevision = null;
  }

  private handleSourceChanged(): void {
    this.scheduleCheckpointBuild();
  }

  private scheduleCheckpointBuild(): void {
    this.clearScheduledBuild();
    this.buildTimer = setTimeout(() => {
      this.buildTimer = null;
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        this.idleHandle = window.requestIdleCallback(() => {
          this.idleHandle = null;
          this.buildCheckpoint();
        });
        return;
      }
      this.buildCheckpoint();
    }, this.options.scheduleDelayMs ?? DEFAULT_CHECKPOINT_IDLE_MS);
  }

  private clearScheduledBuild(): void {
    if (this.buildTimer) {
      clearTimeout(this.buildTimer);
      this.buildTimer = null;
    }
    if (
      this.idleHandle != null &&
      typeof window !== 'undefined' &&
      typeof window.cancelIdleCallback === 'function'
    ) {
      window.cancelIdleCallback(this.idleHandle);
      this.idleHandle = null;
    }
  }

  private buildCheckpoint(): DocumentCheckpoint {
    const currentRevision = this.options.revisionSource.getRevision();
    const rawSnapshot = this.options.exportSnapshot();
    const snapshot = this.options.snapshotCodec.encodeForPersistence(rawSnapshot);
    const compatibilityArtifact = this.options.artifactSerializer?.build(rawSnapshot) ?? null;
    const checkpoint: DocumentCheckpoint = {
      documentId: this.options.metadata.documentId,
      pluginId: this.options.metadata.pluginId,
      engineId: this.options.metadata.engineId,
      pluginSchemaVersion: this.options.metadata.pluginSchemaVersion,
      snapshotFormatVersion: this.options.snapshotCodec.snapshotFormatVersion,
      artifactVersion: this.options.artifactSerializer?.artifactVersion ?? null,
      revision: currentRevision,
      snapshot,
      compatibilityArtifact,
    };
    this.cachedCheckpoint = checkpoint;
    this.builtRevision = currentRevision;
    return checkpoint;
  }
}
