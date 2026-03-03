import { useState, useCallback } from 'react';
import type { Node, Connection } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useCanvasStore from '@/stores/useCanvasStore';
import type { RelationType, TableNodeData } from '@/types/erd';

/**
 * FK 연결 모드 상태와 로직을 캡슐화하는 훅.
 *
 * @returns FK 모드 상태, 토글 함수, 노드 클릭 핸들러, 다이얼로그 상태
 */
export function useFkConnectMode() {
  const { t } = useTranslation();

  /** FK 연결 모드 활성 여부 */
  const [fkMode, setFkMode] = useState(false);
  /** 선택된 부모 노드 ID */
  const [parentNodeId, setParentNodeId] = useState<string | null>(null);
  /** 대기 중인 자식 노드 ID (다이얼로그 표시용) */
  const [pendingChildId, setPendingChildId] = useState<string | null>(null);
  /** 관계 유형 선택 다이얼로그 열림 여부 */
  const [fkTypeDialogOpen, setFkTypeDialogOpen] = useState(false);

  /** Handle 드래그에서 대기 중인 연결 정보 */
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const addFkRelation = useCanvasStore((s) => s.addFkRelation);
  const connectWithRelationType = useCanvasStore((s) => s.connectWithRelationType);
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);

  /** FK 모드 상태를 초기화하고 하이라이트를 해제한다. */
  const resetFkMode = useCallback(() => {
    setFkMode(false);
    setParentNodeId(null);
    setPendingChildId(null);
    setPendingConnection(null);
    setFkTypeDialogOpen(false);
    clearHighlights();
  }, [clearHighlights]);

  /** FK 연결 모드를 토글한다. 해제 시 상태를 초기화한다. */
  const toggleFkMode = () => {
    if (fkMode) {
      resetFkMode();
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
    resetFkMode();
    toast.info(t('erd.fkMode.cancelled'));
  }, [resetFkMode, t]);

  /**
   * FK 연결 모드에서 노드 클릭 시 호출되는 핸들러.
   * 첫 번째 클릭: 부모 테이블 선택, 두 번째 클릭: 관계 유형 다이얼로그 표시.
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
      // 두 번째 클릭: 자식 선택 → 다이얼로그 표시
      setPendingChildId(node.id);
      setFkTypeDialogOpen(true);
    }
  };

  /**
   * Handle 드래그 연결 시 호출되는 핸들러.
   * 연결 정보를 저장하고 관계 유형 선택 다이얼로그를 표시한다.
   *
   * @param connection React Flow 연결 정보
   */
  const handleDragConnect = (connection: Connection) => {
    setPendingConnection(connection);
    setFkTypeDialogOpen(true);
  };

  /**
   * 관계 유형 선택 후 FK 관계를 생성한다.
   * Handle 드래그와 FK Connect 모드 두 경로를 모두 처리한다.
   *
   * @param relationType 선택된 관계 유형
   */
  const handleFkTypeSelect = (relationType: RelationType) => {
    // Handle 드래그 연결
    if (pendingConnection) {
      connectWithRelationType(
        pendingConnection.source!,
        pendingConnection.target!,
        pendingConnection.sourceHandle ?? undefined,
        pendingConnection.targetHandle ?? undefined,
        relationType,
      );
      setPendingConnection(null);
      setFkTypeDialogOpen(false);
      return;
    }

    // FK Connect 모드 (2-클릭)
    if (!parentNodeId || !pendingChildId) return;

    const parentNode = nodes.find((n) => n.id === parentNodeId);
    const childNode = nodes.find((n) => n.id === pendingChildId);
    if (!parentNode || !childNode) return;

    const pkColumns = parentNode.data.columns.filter((c) => c.pk);
    const existingNames = childNode.data.columns.map((c) => c.name);

    const createdCount = addFkRelation({
      parentNodeId: parentNode.id,
      childNodeId: childNode.id,
      pkColumns,
      parentLabel: parentNode.data.label,
      existingNames,
      relationType,
    });

    if (createdCount > 0) {
      toast.success(t('erd.fkMode.success', { count: createdCount }));
    }

    resetFkMode();
  };

  /**
   * 관계 유형 다이얼로그가 닫힐 때 대기 상태를 정리한다.
   */
  const handleFkTypeDialogClose = () => {
    setPendingConnection(null);
    setPendingChildId(null);
    setFkTypeDialogOpen(false);
  };

  return {
    fkMode,
    toggleFkMode,
    cancelFkMode,
    handleNodeClickInFkMode,
    handleDragConnect,
    fkTypeDialogOpen,
    handleFkTypeSelect,
    handleFkTypeDialogClose,
  };
}
