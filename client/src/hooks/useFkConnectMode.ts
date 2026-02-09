import { useState, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useCanvasStore from '@/stores/useCanvasStore';
import type { TableNodeData } from '@/types/erd';

/**
 * 테이블명을 FK 컬럼명 접두사로 사용할 수 있도록 정규화한다.
 * 소문자로 변환하고, 공백을 언더스코어로 바꾸고, 영문/숫자/언더스코어 외 문자를 제거한다.
 *
 * @param name 테이블명
 * @returns 정규화된 문자열
 */
function sanitizeTableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * 기존 컬럼명 목록에서 중복되지 않는 고유한 이름을 생성한다.
 * 기본명이 중복이면 _1, _2, ... suffix를 추가한다.
 *
 * @param base     기본 컬럼명
 * @param existing 기존 컬럼명 배열
 * @returns 고유한 컬럼명
 */
function generateUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 1;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

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
  const addFkColumn = useCanvasStore((s) => s.addFkColumn);
  const addFkEdge = useCanvasStore((s) => s.addFkEdge);
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
      const parentPrefix = sanitizeTableName(parentNode.data.label);

      let createdCount = 0;

      for (const pkCol of pkColumns) {
        const baseName = `${parentPrefix}_${pkCol.name}`;
        const fkName = generateUniqueName(baseName, [...existingNames]);
        existingNames.push(fkName);

        const fkColId = `col-${crypto.randomUUID()}`;
        addFkColumn(childNode.id, {
          id: fkColId,
          name: fkName,
          type: pkCol.type,
          fk: true,
          nullable: true,
        });

        const sourceHandle = `${parentNode.id}-${pkCol.id}-source`;
        const targetHandle = `${childNode.id}-${fkColId}-target`;
        addFkEdge(parentNode.id, sourceHandle, childNode.id, targetHandle);
        createdCount++;
      }

      toast.success(t('erd.fkMode.success', { count: createdCount }));
      setFkMode(false);
      setParentNodeId(null);
      clearHighlights();
    }
  };

  return {
    fkMode,
    parentNodeId,
    toggleFkMode,
    cancelFkMode,
    handleNodeClickInFkMode,
  };
}
