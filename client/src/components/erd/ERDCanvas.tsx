import { lazy, memo, Suspense, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';
import { useHotkeys } from 'react-hotkeys-hook';
import useCanvasStore from '@/stores/useCanvasStore';
import { extractColId } from '@/lib/handle-id';
import type { TableNodeData } from '@/types/erd';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import { KEYBINDINGS } from '@/constants/keybindings';
import { applyDagreLayout } from '@/lib/auto-layout';
import { cn } from '@/lib/utils';
import { useFkConnectMode } from '@/hooks/useFkConnectMode';
import { useExportDiagram } from '@/hooks/useExportDiagram';
import { useAwareness } from '@/hooks/useAwareness';
import TableNode from './TableNode';
import GroupNode from './GroupNode';
import CanvasToolbar from './CanvasToolbar';
import EdgeContextMenu from './EdgeContextMenu';
import DeleteEdgeDialog from './DeleteEdgeDialog';
import DdlExportDialog from './DdlExportDialog';
import FkTypeDialog from './FkTypeDialog';
import ErdRelationEdge from './ErdRelationEdge';
import RemoteCursors from './RemoteCursors';
import { ErdFkModeProvider } from './ErdFkModeContext';

const DdlImportDialog = lazy(() => import('./DdlImportDialog'));

/** React Flow에 등록할 커스텀 노드 타입 매핑 */
const nodeTypes: NodeTypes = {
  table: TableNode,
  group: GroupNode,
};

/** React Flow에 등록할 커스텀 엣지 타입 매핑 */
const edgeTypes: EdgeTypes = {
  erdRelation: ErdRelationEdge,
};

/** 노드 수가 임계치를 넘으면 MiniMap을 자동 숨김하여 드래그 성능을 우선한다. */
const MINIMAP_NODE_LIMIT = 80;

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
  /** YjsProvider 인스턴스 (실시간 협업 시 커서 발행용) */
  provider?: YjsProvider | null;
  /** 유효성 검사 패널 열림 여부 */
  validationOpen?: boolean;
  /** 유효성 검사 패널 토글 핸들러 */
  onToggleValidation?: () => void;
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
  /** 코드 에디터 활성 여부 */
  codeEditorActive?: boolean;
  /** 코드 에디터 토글 핸들러 */
  onToggleCodeEditor?: () => void;
  /** 사이드바 리사이즈 진행 여부 (성능 최적화용) */
  isSidebarResizing?: boolean;
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
 * @param props.provider   YjsProvider 인스턴스 (실시간 협업 시 커서 발행용)
 * @param props.canEdit    편집 가능 여부 (VIEWER일 때 false)
 */
function ERDCanvas({
  diagramName = 'diagram',
  provider,
  validationOpen,
  onToggleValidation,
  canEdit = true,
  codeEditorActive,
  onToggleCodeEditor,
  isSidebarResizing = false,
}: ERDCanvasProps) {
  /** 캔버스 컨테이너 ref (Awareness 커서 추적용) */
  const canvasRef = useRef<HTMLDivElement>(null);
  useAwareness(provider ?? null, canvasRef);
  const { nodes, edges, groupNodes, onNodesChange, onEdgesChange } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      groupNodes: s.groupNodes,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
    })),
  );

  /** 그룹 노드를 테이블 노드 아래에 합산하여 React Flow에 전달 */
  const allNodes = useMemo(() => [...groupNodes, ...nodes] as Node[], [groupNodes, nodes]);

  const highlightedEdgeId = useCanvasStore((s) => s.highlightedEdgeId);
  const setHighlightedEdge = useCanvasStore((s) => s.setHighlightedEdge);
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const removeEdgeWithFkColumn = useCanvasStore((s) => s.removeEdgeWithFkColumn);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const setActiveEditNodeId = useCanvasStore((s) => s.setActiveEditNodeId);

  const {
    fkMode,
    toggleFkMode,
    cancelFkMode,
    handleNodeClickInFkMode,
    handleDragConnect,
    fkTypeDialogOpen,
    handleFkTypeSelect,
    handleFkTypeDialogClose,
  } = useFkConnectMode();
  const { exportPng, exportJpg, exportSvg, exportPdf } = useExportDiagram(diagramName);

  /** 엣지 컨텍스트 메뉴 상태 */
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  /** 엣지 삭제 다이얼로그 상태 */
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  /** DDL 내보내기 다이얼로그 열림 상태 */
  const [ddlDialogOpen, setDdlDialogOpen] = useState(false);
  /** DDL 가져오기 다이얼로그 열림 상태 */
  const [ddlImportOpen, setDdlImportOpen] = useState(false);
  /** 노드 드래그 진행 여부 (드래그 중 성능 우선 렌더링 제어용) */
  const [isDraggingNode, setIsDraggingNode] = useState(false);

  /**
   * 엣지에 대한 삭제 다이얼로그를 여는 공통 함수.
   *
   * @param edgeId 삭제 대상 엣지 ID
   */
  const openDeleteDialog = (edgeId: string) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) {
      return;
    }

    const childNode = nodes.find((n) => n.id === edge.target);
    if (!childNode) {
      return;
    }

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
  };

  /** 엣지 클릭 — 하이라이트 적용 */
  const handleEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setHighlightedEdge(edge.id);
    setHighlightedNodes([edge.source, edge.target]);
  };

  /** 노드 클릭 — FK 모드일 때 FK 핸들러 호출, 일반 클릭 시 편집 모드 진입 */
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    if (fkMode && node.type === 'table') {
      handleNodeClickInFkMode(event, node as Node<TableNodeData>);
      return;
    }
    if (node.type === 'table') {
      setActiveEditNodeId(node.id);
    }
  };

  /** 캔버스 빈 영역 클릭 — 하이라이트 해제 + 편집 모드 해제 */
  const handlePaneClick = () => {
    clearHighlights();
    setContextMenu(null);
    setActiveEditNodeId(null);
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
    { enabled: canEdit && !!highlightedEdgeId },
  );

  /** Escape 키 — FK 모드 해제 */
  useHotkeys(KEYBINDINGS.ESCAPE, cancelFkMode, { enabled: fkMode });

  /** 엣지에 하이라이트 스타일 적용 */
  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        selected: e.id === highlightedEdgeId,
        animated: !isDraggingNode && e.id === highlightedEdgeId,
      })),
    [edges, highlightedEdgeId, isDraggingNode],
  );

  const showOverlayWidgets = !isDraggingNode;
  const showPerformanceOverlays = showOverlayWidgets && !isSidebarResizing;
  const showMiniMap = showPerformanceOverlays && allNodes.length <= MINIMAP_NODE_LIMIT;

  return (
    <div className="w-full h-full" ref={canvasRef}>
      <ErdFkModeProvider value={fkMode}>
        <ReactFlow
          nodes={allNodes}
          edges={styledEdges}
          onNodesChange={canEdit ? onNodesChange : undefined}
          onEdgesChange={canEdit ? onEdgesChange : undefined}
          onConnect={canEdit ? handleDragConnect : undefined}
          onNodeClick={handleNodeClick}
          onNodeDragStart={canEdit ? () => setIsDraggingNode(true) : undefined}
          onNodeDragStop={canEdit ? () => setIsDraggingNode(false) : undefined}
          onEdgeClick={handleEdgeClick}
          onEdgeContextMenu={canEdit ? handleEdgeContextMenu : undefined}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={null}
          panActivationKeyCode={null}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={{
            type: 'erdRelation',
          }}
          fitView
          className={cn(fkMode && 'cursor-crosshair')}
        >
          {showPerformanceOverlays && (
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          )}
          {showPerformanceOverlays && <Controls />}
          {showMiniMap && (
            <MiniMap
              nodeStrokeColor="hsl(var(--muted-foreground))"
              nodeColor="hsl(var(--card))"
              nodeBorderRadius={4}
            />
          )}
          <CanvasToolbar
            fkMode={fkMode}
            onToggleFkMode={toggleFkMode}
            onAutoLayout={handleAutoLayout}
            onExportPng={exportPng}
            onExportJpg={exportJpg}
            onExportSvg={exportSvg}
            onExportPdf={exportPdf}
            onExportDdl={() => setDdlDialogOpen(true)}
            onImportDdl={() => setDdlImportOpen(true)}
            codeEditorActive={codeEditorActive}
            onToggleCodeEditor={onToggleCodeEditor}
            validationOpen={validationOpen}
            onToggleValidation={onToggleValidation}
            canEdit={canEdit}
          />
        </ReactFlow>
      </ErdFkModeProvider>

      {showPerformanceOverlays && <RemoteCursors />}

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

      <DdlExportDialog
        open={ddlDialogOpen}
        onOpenChange={setDdlDialogOpen}
        diagramName={diagramName}
      />

      {ddlImportOpen && (
        <Suspense fallback={null}>
          <DdlImportDialog open={ddlImportOpen} onOpenChange={setDdlImportOpen} />
        </Suspense>
      )}

      <FkTypeDialog
        open={fkTypeDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleFkTypeDialogClose();
          }
        }}
        onSelect={handleFkTypeSelect}
      />
    </div>
  );
}

export default memo(ERDCanvas);
