import { useState, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useCanvasStore from '@/stores/useCanvasStore';
import type { TableNodeData } from '@/types/erd';

/**
 * FK 연결 모드 상태와 로직을 캡슐화하는 훅.
 *
 * @returns FK 모드 상태, 토글 함수, 노드 클릭 핸들러
 */
export function useFkConnectMode() {
  const { t } = useTranslation();

  /** FK 연결 모드 활성 여부 */
  const [fkMode, setFkMode] = useState(false);
  /** 선택된 부모 노드 ID */
  const [parentNodeId, setParentNodeId] = useState<string | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const addFkRelation = useCanvasStore((s) => s.addFkRelation);
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);

  /** FK 연결 모드를 토글한다. 해제 시 상태를 초기화한다. */
  const toggleFkMode = () => {
    if (fkMode) {
      setFkMode(false);
      setParentNodeId(null);
      clearHighlights();
    } else {
      setFkMode(true);
      toast.info(t('erd.fkMode.selectParent'));
    }
  };

  /**
   * FK 연결 모드를 해제하고 상태를 초기화한다.
   * useHotkeys 콜백에서 참조되므로 useCallback 유지.
   */
  const cancelFkMode = useCallback(() => {
    setFkMode(false);
    setParentNodeId(null);
    clearHighlights();
    toast.info(t('erd.fkMode.cancelled'));
  }, [clearHighlights, t]);

  /**
   * FK 연결 모드에서 노드 클릭 시 호출되는 핸들러.
   * 첫 번째 클릭: 부모 테이블 선택, 두 번째 클릭: FK 관계 생성.
   *
   * @param _event 마우스 이벤트
   * @param node   클릭된 노드
   */
  const handleNodeClickInFkMode = (_event: React.MouseEvent, node: Node<TableNodeData>) => {
    if (!parentNodeId) {
      // 첫 번째 클릭: 부모 선택
      const pkColumns = node.data.columns.filter((c) => c.pk);
      if (pkColumns.length === 0) {
        toast.error(t('erd.fkMode.noPk'));
        return;
      }
      setParentNodeId(node.id);
      setHighlightedNodes([node.id]);
      toast.info(t('erd.fkMode.selectChild'));
    } else {
      // 두 번째 클릭: 자식 선택 → FK 생성
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;

      const childNode = node;
      const pkColumns = parentNode.data.columns.filter((c) => c.pk);
      const existingNames = childNode.data.columns.map((c) => c.name);

      const createdCount = addFkRelation(
        parentNode.id,
        childNode.id,
        pkColumns,
        parentNode.data.label,
        existingNames,
      );

      if (createdCount > 0) {
        toast.success(t('erd.fkMode.success', { count: createdCount }));
      }
      setFkMode(false);
      setParentNodeId(null);
      clearHighlights();
    }
  };

  return {
    fkMode,
    toggleFkMode,
    cancelFkMode,
    handleNodeClickInFkMode,
  };
}
