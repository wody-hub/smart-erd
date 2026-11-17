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
  isReady: () => boolean;
  getHydratedSnapshot: () => Uint8Array | null;
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

  get ready(): boolean {
    return this.params.isReady() && this.params.getHydratedSnapshot() != null;
  }

  getLatestCheckpoint(): DocumentCheckpoint | null {
    if (!this.ready) return null;
    const checkpoint = this.params.checkpointReader?.getLatestCheckpoint() ?? null;
    // 빈 Y.Doc도 2바이트로 인코딩되므로 길이 0 검사만으로는 빈 문서를 거를 수 없다.
    // 수화된 문서를 그대로 저장하는 것은 멱등이므로 명시적 백업은 변경 여부를 요구하지 않는다.
    if (!checkpoint || checkpoint.snapshot.length <= 2) {
      return null;
    }
    return checkpoint;
  }

  /**
   * 수화 이후 실제로 바뀐 체크포인트만 반환한다. pagehide/hidden/cleanup 같은 자동 저장 전용이다.
   *
   * @returns 수화 기준과 다른 체크포인트. 준비 전이거나 변경이 없으면 null
   */
  getChangedCheckpoint(): DocumentCheckpoint | null {
    const checkpoint = this.getLatestCheckpoint();
    const baseline = this.params.getHydratedSnapshot();
    if (!checkpoint || !baseline || equalSnapshot(checkpoint.snapshot, baseline)) {
      return null;
    }
    return checkpoint;
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
    // mutation 예약 이후 연결/권한이 바뀌었으면 성공 처리하지 않는다.
    if (!this.getLatestCheckpoint()) {
      throw new Error('Diagram snapshot is not ready for persistence');
    }
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

function equalSnapshot(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
