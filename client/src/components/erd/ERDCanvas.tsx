import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  type NodeTypes,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';
import { useHotkeys } from 'react-hotkeys-hook';
import useCanvasStore, { extractColId } from '@/stores/useCanvasStore';
import type { TableNodeData } from '@/types/erd';
import { KEYBINDINGS } from '@/constants/keybindings';
import { applyDagreLayout } from '@/lib/auto-layout';
import { cn } from '@/lib/utils';
import { useFkConnectMode } from '@/hooks/useFkConnectMode';
import { useExportDiagram } from '@/hooks/useExportDiagram';
import TableNode from './TableNode';
import CanvasToolbar from './CanvasToolbar';
import EdgeContextMenu from './EdgeContextMenu';
import DeleteEdgeDialog from './DeleteEdgeDialog';

/** React Flow에 등록할 커스텀 노드 타입 매핑 */
const nodeTypes: NodeTypes = {
  table: TableNode,
};

/** 엣지 컨텍스트 메뉴 상태 */
interface ContextMenuState {
  /** 대상 엣지 ID */
  edgeId: string;
  /** 메뉴 표시 위치 */
  position: { x: number; y: number };
}

/** ERDCanvas 컴포넌트의 props. */
interface ERDCanvasProps {
  /** 내보내기 시 파일명에 사용할 다이어그램 이름 */
  diagramName?: string;
}

/** 삭제 다이얼로그 상태 */
interface DeleteDialogState {
  /** 대상 엣지 ID */
  edgeId: string;
  /** 자식 테이블 이름 */
  childTableName: string;
  /** FK 컬럼 정보 문자열 */
  fkColumnsText: string;
}

/**
 * ERD 캔버스 컴포넌트.
 *
 * React Flow를 사용하여 테이블 노드와 관계 엣지를 시각화한다.
 * 16x16 그리드 스냅, 미니맵, 컨트롤, step 타입 엣지(화살표)를 기본 설정으로 사용한다.
 * 플로팅 툴바(FK Connect, Auto Layout, Export), 엣지 클릭 하이라이트, 컨텍스트 메뉴,
 * Delete 키 삭제 다이얼로그, FK 연결 모드를 지원한다.
 * 상태는 {@link useCanvasStore}에서 관리한다.
 *
 * @param props.diagramName 내보내기 시 파일명에 사용할 다이어그램 이름
 */
export default function ERDCanvas({ diagramName = 'diagram' }: ERDCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
    })),
  );

  const highlightedEdgeId = useCanvasStore((s) => s.highlightedEdgeId);
  const setHighlightedEdge = useCanvasStore((s) => s.setHighlightedEdge);
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const removeEdgeWithFkColumn = useCanvasStore((s) => s.removeEdgeWithFkColumn);
  const applyLayout = useCanvasStore((s) => s.applyLayout);

  const { fkMode, toggleFkMode, cancelFkMode, handleNodeClickInFkMode } = useFkConnectMode();
  const { exportPng, exportJpg, exportSvg, exportPdf } = useExportDiagram(diagramName);

  /** 엣지 컨텍스트 메뉴 상태 */
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  /** 엣지 삭제 다이얼로그 상태 */
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);

  /**
   * 엣지에 대한 삭제 다이얼로그를 여는 공통 함수.
   * useHotkeys 콜백에서 참조되므로 useCallback 유지.
   *
   * @param edgeId 삭제 대상 엣지 ID
   */
  const openDeleteDialog = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const childNode = nodes.find((n) => n.id === edge.target);
      if (!childNode) return;

      let fkColumnsText = '';
      if (edge.targetHandle) {
        const colId = extractColId(edge.targetHandle, edge.target);
        const col = childNode.data.columns.find((c) => c.id === colId);
        if (col) {
          fkColumnsText = `${col.name} (${col.type})`;
        }
      }

      setDeleteDialog({
        edgeId,
        childTableName: childNode.data.label,
        fkColumnsText,
      });
    },
    [edges, nodes],
  );

  /** 엣지 클릭 — 하이라이트 적용 */
  const handleEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setHighlightedEdge(edge.id);
    setHighlightedNodes([edge.source, edge.target]);
  };

  /** 노드 클릭 — FK 모드일 때만 FK 핸들러 호출 */
  const handleNodeClick = (event: React.MouseEvent, node: Node<TableNodeData>) => {
    if (fkMode) {
      handleNodeClickInFkMode(event, node);
    }
  };

  /** 캔버스 빈 영역 클릭 — 하이라이트 해제 */
  const handlePaneClick = () => {
    clearHighlights();
    setContextMenu(null);
  };

  /** 엣지 우클릭 — 컨텍스트 메뉴 표시 */
  const handleEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({ edgeId: edge.id, position: { x: event.clientX, y: event.clientY } });
  };

  /** 자동 배치 실행 */
  const handleAutoLayout = () => {
    const layoutedNodes = applyDagreLayout(nodes, edges);
    applyLayout(layoutedNodes);
  };

  /** Delete 키 — 하이라이트된 엣지 삭제 다이얼로그 */
  useHotkeys(
    KEYBINDINGS.DELETE,
    () => {
      if (highlightedEdgeId) {
        openDeleteDialog(highlightedEdgeId);
      }
    },
    { enabled: !!highlightedEdgeId },
  );

  /** Escape 키 — FK 모드 해제 */
  useHotkeys(KEYBINDINGS.ESCAPE, cancelFkMode, { enabled: fkMode });

  /** 엣지에 하이라이트 스타일 적용 */
  const styledEdges = edges.map((e) => ({
    ...e,
    style:
      e.id === highlightedEdgeId ? { stroke: 'hsl(var(--primary))', strokeWidth: 2.5 } : undefined,
    animated: e.id === highlightedEdgeId,
  }));

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        deleteKeyCode={null}
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'step',
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        fitView
        className={cn(fkMode && 'cursor-crosshair')}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeColor="hsl(var(--muted-foreground))"
          nodeColor="hsl(var(--card))"
          nodeBorderRadius={4}
        />
        <CanvasToolbar
          fkMode={fkMode}
          onToggleFkMode={toggleFkMode}
          onAutoLayout={handleAutoLayout}
          onExportPng={exportPng}
          onExportJpg={exportJpg}
          onExportSvg={exportSvg}
          onExportPdf={exportPdf}
        />
      </ReactFlow>

      {contextMenu && (
        <EdgeContextMenu
          position={contextMenu.position}
          onDelete={() => {
            openDeleteDialog(contextMenu.edgeId);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {deleteDialog && (
        <DeleteEdgeDialog
          open={!!deleteDialog}
          onOpenChange={(open) => {
            if (!open) setDeleteDialog(null);
          }}
          childTableName={deleteDialog.childTableName}
          fkColumnsText={deleteDialog.fkColumnsText}
          onRemoveFk={() => {
            removeEdgeWithFkColumn(deleteDialog.edgeId);
            setDeleteDialog(null);
          }}
          onKeepFk={() => {
            removeEdge(deleteDialog.edgeId);
            setDeleteDialog(null);
          }}
        />
      )}
    </div>
  );
}
