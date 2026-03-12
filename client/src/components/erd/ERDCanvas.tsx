import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { useRemoteEditLocks } from '@/hooks/useRemoteEditLocks';
import TableNode from './TableNode';
import RemoteEditLocksProvider from './RemoteEditLocksProvider';
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
  /** 활성 그룹 ID (null이면 전체 보기) */
  activeGroupId?: string | null;
  /** 활성 그룹 이름 (읽기 전용 aria 라벨용) */
  activeGroupName?: string | null;
  /** 활성 그룹의 테이블 ID 집합 */
  activeGroupTableIds?: Set<string> | null;
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
 * @returns ERD 캔버스 JSX
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
  activeGroupId,
  activeGroupName,
  activeGroupTableIds,
}: ERDCanvasProps) {
  const { t } = useTranslation();
  const reactFlowInstance = useReactFlow();
  /** 캔버스 컨테이너 ref (Awareness 커서 추적용) */
  const canvasRef = useRef<HTMLDivElement>(null);
  /** 동일 락 토스트 중복 방지용 ref */
  const lastBlockedNodeRef = useRef<string | null>(null);
  useAwareness(provider ?? null, canvasRef);
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
    })),
  );

  const highlightedEdgeId = useCanvasStore((s) => s.highlightedEdgeId);
  const activeEditNodeId = useCanvasStore((s) => s.activeEditNodeId);
  const setHighlightedEdge = useCanvasStore((s) => s.setHighlightedEdge);
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes);
  const clearHighlights = useCanvasStore((s) => s.clearHighlights);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const removeEdgeWithFkColumn = useCanvasStore((s) => s.removeEdgeWithFkColumn);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const stopHistoryCapture = useCanvasStore((s) => s.stopHistoryCapture);
  const setActiveEditNodeId = useCanvasStore((s) => s.setActiveEditNodeId);
  const remoteEditLocks = useRemoteEditLocks();
  const { locksByNodeId } = remoteEditLocks;

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

  /** 그룹 뷰 활성 여부 */
  const isGroupView = !!activeGroupId && !!activeGroupTableIds;
  /** 그룹 뷰에서는 모든 편집 기능을 차단한다. */
  const effectiveCanEdit = canEdit && !isGroupView;

  /** 그룹 뷰일 때 필터링된 노드, 아닐 때 전체 노드 */
  const displayNodes = useMemo(() => {
    if (!activeGroupTableIds) {
      return nodes;
    }
    return nodes.filter((node) => activeGroupTableIds.has(node.id));
  }, [nodes, activeGroupTableIds]);

  /** 그룹 뷰일 때 양쪽 노드가 모두 속한 엣지만 노출한다. */
  const displayEdges = useMemo(() => {
    if (!activeGroupTableIds) {
      return edges;
    }
    return edges.filter(
      (edge) => activeGroupTableIds.has(edge.source) && activeGroupTableIds.has(edge.target),
    );
  }, [edges, activeGroupTableIds]);

  // 그룹 뷰 전환 시 필터링된 노드에 맞춰 뷰포트를 보정한다.
  useEffect(() => {
    if (!isGroupView || displayNodes.length === 0) {
      return;
    }
    requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    });
  }, [activeGroupId, displayNodes.length, isGroupView, reactFlowInstance]);

  /**
   * 엣지에 대한 삭제 다이얼로그를 여는 공통 함수.
   *
   * @param edgeId 삭제 대상 엣지 ID
   * @returns 없음
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

  /**
   * 엣지 클릭 시 하이라이트를 갱신한다.
   *
   * @param _ 클릭 이벤트
   * @param edge 클릭된 엣지
   * @returns 없음
   */
  const handleEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setHighlightedEdge(edge.id);
    setHighlightedNodes([edge.source, edge.target]);
  };

  /**
   * 노드 클릭을 처리한다.
   *
   * @param event 노드 클릭 이벤트
   * @param node 클릭된 노드
   * @returns 없음
   */
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    if (fkMode && effectiveCanEdit && node.type === 'table') {
      handleNodeClickInFkMode(event, node as Node<TableNodeData>);
      return;
    }
    if (effectiveCanEdit && node.type === 'table') {
      const lockInfo = locksByNodeId.get(node.id);
      if (lockInfo) {
        if (lastBlockedNodeRef.current !== node.id) {
          toast.info(t('erd.lock.blockedEditToast', { name: lockInfo.name }));
          lastBlockedNodeRef.current = node.id;
        }
        return;
      }

      lastBlockedNodeRef.current = null;
      setActiveEditNodeId(node.id);
    }
  };

  /**
   * 캔버스 빈 영역 클릭을 처리한다.
   *
   * @returns 없음
   */
  const handlePaneClick = () => {
    clearHighlights();
    setContextMenu(null);
    setActiveEditNodeId(null);
    lastBlockedNodeRef.current = null;
  };

  // 편집 중인 노드가 원격 락 상태가 되면 즉시 편집 모드를 해제한다.
  useEffect(() => {
    if (!activeEditNodeId) {
      return;
    }
    const lockInfo = locksByNodeId.get(activeEditNodeId);
    if (!lockInfo) {
      return;
    }
    setActiveEditNodeId(null);
    toast.info(t('erd.lock.blockedEditToast', { name: lockInfo.name }));
  }, [activeEditNodeId, locksByNodeId, setActiveEditNodeId, t]);

  /**
   * 엣지 우클릭 시 컨텍스트 메뉴를 연다.
   *
   * @param event 마우스 이벤트
   * @param edge 대상 엣지
   * @returns 없음
   */
  const handleEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({ edgeId: edge.id, position: { x: event.clientX, y: event.clientY } });
  };

  /**
   * 자동 배치를 실행한다.
   *
   * @returns 없음
   */
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
    { enabled: effectiveCanEdit && !!highlightedEdgeId },
  );

  /** Escape 키 — FK 모드 해제 */
  useHotkeys(KEYBINDINGS.ESCAPE, cancelFkMode, { enabled: fkMode });

  /** 엣지에 하이라이트 스타일 적용 */
  const styledEdges = useMemo(
    () =>
      displayEdges.map((edge) => ({
        ...edge,
        selected: edge.id === highlightedEdgeId,
        animated: !isDraggingNode && edge.id === highlightedEdgeId,
      })),
    [displayEdges, highlightedEdgeId, isDraggingNode],
  );

  const showOverlayWidgets = !isDraggingNode;
  const showPerformanceOverlays = showOverlayWidgets && !isSidebarResizing;
  const showMiniMap = showPerformanceOverlays && displayNodes.length <= MINIMAP_NODE_LIMIT;

  return (
    <div
      className="w-full h-full"
      ref={canvasRef}
      role={isGroupView ? 'region' : undefined}
      aria-label={
        isGroupView
          ? t('erd.group.aria.readonlyCanvas', { name: activeGroupName ?? '' })
          : undefined
      }
    >
      <ErdFkModeProvider value={fkMode}>
        <RemoteEditLocksProvider value={remoteEditLocks}>
          <ReactFlow
            nodes={displayNodes}
            edges={styledEdges}
            onNodesChange={effectiveCanEdit ? onNodesChange : undefined}
            onEdgesChange={effectiveCanEdit ? onEdgesChange : undefined}
            onConnect={effectiveCanEdit ? handleDragConnect : undefined}
            onNodeClick={handleNodeClick}
            onNodeDragStart={effectiveCanEdit ? () => setIsDraggingNode(true) : undefined}
            onNodeDragStop={
              effectiveCanEdit
                ? () => {
                    setIsDraggingNode(false);
                    stopHistoryCapture();
                  }
                : undefined
            }
            onEdgeClick={handleEdgeClick}
            onEdgeContextMenu={effectiveCanEdit ? handleEdgeContextMenu : undefined}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={null}
            panActivationKeyCode={null}
            nodesDraggable={effectiveCanEdit}
            nodesConnectable={effectiveCanEdit}
            elementsSelectable={effectiveCanEdit}
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
              canUndo={effectiveCanEdit && canUndo}
              canRedo={effectiveCanEdit && canRedo}
              onUndo={undo}
              onRedo={redo}
              canEdit={effectiveCanEdit}
            />
          </ReactFlow>
        </RemoteEditLocksProvider>
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
