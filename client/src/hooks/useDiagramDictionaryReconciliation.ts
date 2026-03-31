import { useEffect, useRef } from 'react';
import type { PreviewSyncStatus } from '@/collaboration/core/collaboration-preview-sync-status';
import { useDiagramDictionaryReconciliationActions } from '@/collaboration/channel/diagram/use-diagram-dictionary-reconciliation-actions';
import { useDiagramErdNodesSnapshot } from '@/collaboration/channel/diagram/use-diagram-erd-read-snapshot';
import { useErdDictionary } from '@/components/erd/ErdDictionaryContext';
import { buildDiagramDictionaryReconciliationPlan } from '@/lib/diagram-dictionary-reconciliation';

interface UseDiagramDictionaryReconciliationParams {
  diagramId: string;
  isPreviewMode: boolean;
  previewSyncStatus: PreviewSyncStatus;
}

/**
 * ERD 진입 시 현재 사전 기준으로 테이블/컬럼 메타데이터를 1회 재조정한다.
 *
 * 용어/도메인 수정 이후 다이어그램에 다시 진입하면 최신 사전 상태를 반영한다.
 * 이 조정은 로컬 시스템 트랜잭션으로 적용되어 undo 히스토리와 WS 즉시 broadcast에 포함되지 않는다.
 *
 * @param params.diagramId 다이어그램 ID
 * @returns 없음
 */
export function useDiagramDictionaryReconciliation({
  diagramId,
  isPreviewMode,
  previewSyncStatus,
}: UseDiagramDictionaryReconciliationParams): void {
  const {
    setId,
    isDictionaryReady,
    dictionaryRevision,
    findTermById,
    findDomainById,
    resolveLogicalName,
  } = useErdDictionary();
  const diagramErdNodesSnapshot = useDiagramErdNodesSnapshot();
  const dictionaryReconciliationActions = useDiagramDictionaryReconciliationActions();
  const appliedRevisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !setId ||
      !isDictionaryReady ||
      isPreviewMode ||
      previewSyncStatus === 'syncing' ||
      diagramErdNodesSnapshot.currentNodes.length === 0
    ) {
      return;
    }

    const revisionKey = `${diagramId}:${dictionaryRevision}`;
    const plan = buildDiagramDictionaryReconciliationPlan(diagramErdNodesSnapshot.currentNodes, {
      findTermById,
      findDomainById,
      resolveLogicalName,
    });

    if (plan.tableMetaUpdates.length === 0 && plan.columnUpdates.length === 0) {
      appliedRevisionRef.current = revisionKey;
      return;
    }

    if (appliedRevisionRef.current === revisionKey) {
      return;
    }

    const result = dictionaryReconciliationActions.reconcile(plan, {
      origin: {
        source: 'system',
      },
    });
    if (result === 'applied') {
      appliedRevisionRef.current = revisionKey;
    }
  }, [
    dictionaryReconciliationActions,
    dictionaryRevision,
    diagramErdNodesSnapshot.currentNodes,
    diagramId,
    findDomainById,
    findTermById,
    isPreviewMode,
    isDictionaryReady,
    previewSyncStatus,
    resolveLogicalName,
    setId,
  ]);
}
