import { useEffect, useRef } from 'react';
import { useErdDictionary } from '@/components/erd/ErdDictionaryContext';
import { getTablesMap } from '@/collaboration/yjsBridge';
import { buildDiagramDictionaryReconciliationPlan } from '@/lib/diagram-dictionary-reconciliation';
import useCanvasStore from '@/stores/erd/useCanvasStore';

interface UseDiagramDictionaryReconciliationParams {
  diagramId: string;
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
}: UseDiagramDictionaryReconciliationParams): void {
  const { setId, isDictionaryReady, dictionaryRevision, findTermById, findDomainById, resolveLogicalName } =
    useErdDictionary();
  const nodes = useCanvasStore((state) => state.nodes);
  const ydoc = useCanvasStore((state) => state.ydoc);
  const applyDictionaryReconciliation = useCanvasStore(
    (state) => state.applyDictionaryReconciliation,
  );
  const appliedRevisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ydoc || !setId || !isDictionaryReady || nodes.length === 0 || getTablesMap(ydoc).size === 0) {
      return;
    }

    const revisionKey = `${diagramId}:${dictionaryRevision}`;
    const plan = buildDiagramDictionaryReconciliationPlan(nodes, {
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

    applyDictionaryReconciliation(plan);
    appliedRevisionRef.current = revisionKey;
  }, [
    applyDictionaryReconciliation,
    dictionaryRevision,
    diagramId,
    findDomainById,
    findTermById,
    isDictionaryReady,
    nodes,
    resolveLogicalName,
    setId,
    ydoc,
  ]);
}
