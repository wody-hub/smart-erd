import {
  fetchDiagram,
  persistDiagramYdocSnapshot,
  persistDiagramYdocSnapshotKeepalive,
  saveDiagram,
} from '@/api/diagramApi';
import { isAxiosError } from 'axios';
import { djb2 } from '@/lib/hash';
import type {
  DocumentCheckpoint,
  DocumentCheckpointReader,
} from '@/collaboration/core/contracts/document-checkpoint';
import type { DiagramDetail, SaveDiagramResult } from '@/types/diagram';

interface DiagramDocumentPersistenceSessionParams {
  teamId: string;
  projectId: string;
  diagramId: string;
  checkpointReader: DocumentCheckpointReader | null;
}

export type DiagramSnapshotPersistStatus = 'persisted' | 'stale' | 'missing-checkpoint';

export interface DiagramSnapshotPersistResult {
  status: DiagramSnapshotPersistStatus;
  refreshedDiagram?: DiagramDetail;
}

export interface DiagramPublishedBackup {
  content: string;
  hash: string;
  checkpoint: DocumentCheckpoint;
}

/**
 * 다이어그램 채널 전용 persisted 저장 어댑터.
 *
 * 페이지 계층은 이 세션을 통해 content 저장과 snapshot persist를 호출한다.
 */
export class DiagramDocumentPersistenceSession {
  constructor(private readonly params: DiagramDocumentPersistenceSessionParams) {}

  getLatestCheckpoint(): DocumentCheckpoint | null {
    return this.params.checkpointReader?.getLatestCheckpoint() ?? null;
  }

  preparePublishedBackup(lastBackupHash?: string | null): DiagramPublishedBackup | null {
    const checkpoint = this.getLatestCheckpoint();
    const content = checkpoint ? decodeCompatibilityArtifact(checkpoint) : null;
    if (!checkpoint || content == null) {
      return null;
    }

    const hash = djb2(content);
    if (lastBackupHash != null && hash === lastBackupHash) {
      return null;
    }

    return {
      content,
      hash,
      checkpoint,
    };
  }

  async savePublishedBackup(backup: DiagramPublishedBackup): Promise<SaveDiagramResult> {
    return saveDiagram(
      this.params.teamId,
      this.params.projectId,
      this.params.diagramId,
      backup.content,
      backup.checkpoint.snapshot,
    );
  }

  async persistSnapshot(expectedContentRevision: string): Promise<boolean> {
    const checkpoint = this.getLatestCheckpoint();
    if (!checkpoint) {
      return false;
    }
    return persistDiagramYdocSnapshot(
      this.params.teamId,
      this.params.projectId,
      this.params.diagramId,
      expectedContentRevision,
      checkpoint.snapshot,
    );
  }

  persistSnapshotKeepalive(expectedContentRevision: string): boolean {
    const checkpoint = this.getLatestCheckpoint();
    if (!checkpoint) {
      return false;
    }
    return persistDiagramYdocSnapshotKeepalive(
      this.params.teamId,
      this.params.projectId,
      this.params.diagramId,
      expectedContentRevision,
      checkpoint.snapshot,
    );
  }

  async persistSnapshotWithConflictRetry(
    expectedContentRevision: string,
  ): Promise<DiagramSnapshotPersistResult> {
    const checkpoint = this.getLatestCheckpoint();
    if (!checkpoint) {
      return { status: 'missing-checkpoint' };
    }

    try {
      const persisted = await persistDiagramYdocSnapshot(
        this.params.teamId,
        this.params.projectId,
        this.params.diagramId,
        expectedContentRevision,
        checkpoint.snapshot,
      );
      return { status: persisted ? 'persisted' : 'stale' };
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 409) {
        throw error;
      }

      const refreshedDiagram = await fetchDiagram(
        this.params.teamId,
        this.params.projectId,
        this.params.diagramId,
      );
      return {
        status: 'stale',
        refreshedDiagram,
      };
    }
  }
}

function decodeCompatibilityArtifact(checkpoint: DocumentCheckpoint): string | null {
  if (!checkpoint.compatibilityArtifact || checkpoint.compatibilityArtifact.length === 0) {
    return null;
  }
  return new TextDecoder().decode(checkpoint.compatibilityArtifact);
}
