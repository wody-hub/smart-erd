import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import {
  getAllowedEdgeHandleSelectionValues,
  getCurrentEdgeHandleSelectionValue,
} from '@/lib/edge-handles';
import { extractColId } from '@/lib/handle-id';
import type { ERDEdge, EdgeRoutingType, TableNode as ERDTableNode, TableNodeData, Waypoint } from '@/types/erd';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import {
  CANVAS_HISTORY_ORIGIN,
  DRAG_TRANSACTION_ORIGIN,
} from '@/constants/canvas-history';
import { KEYBINDINGS } from '@/constants/keybindings';
import { applyDagreLayout } from '@/lib/auto-layout';
import type { CodeEditorTableFocusRequest } from '@/lib/code-editor-table-navigation';
import { serializeDiagramDefinitionExportContent } from '@/lib/diagram-definition-export';
import { findPersistedTableNodeForFocus } from '@/lib/diagram-table-focus';
import type { PreviewDraftOverlayGraph } from '@/lib/preview-draft-merge';
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
import ExportProgressDialog from './ExportProgressDialog';
import FkTypeDialog from './FkTypeDialog';
import ErdRelationEdge from './ErdRelationEdge';
import { previewNodeTypes } from './PreviewTableNodes';
import {
  applyHeaderZoomCssVariables,
  TABLE_HEADER_ZOOM_CHANGE_EPSILON,
  TABLE_HEADER_ZOOM_COMPENSATION_DELAY_MS,
} from './tableHeaderZoom';
import RemoteCursors from './RemoteCursors';
import { ErdFkModeProvider } from './ErdFkModeContext';
import {
  EdgeEditingProvider,
  type BeginSegmentDragParams,
  type SplitSegmentParams,
} from './EdgeEditingContext';
import {
  routePointsToWaypoints,
  shiftOrthogonalSegment,
  toggleOrthogonalSegmentDetail,
} from './edgeWaypointGeometry';

const DdlImportDialog = lazy(() => import('./DdlImportDialog'));

/** React Flow에 등록할 커스텀 노드 타입 매핑 */
const nodeTypes: NodeTypes = {
  table: TableNode,
  ...previewNodeTypes,
};

/** React Flow에 등록할 커스텀 엣지 타입 매핑 */
const edgeTypes: EdgeTypes = {
  erdRelation: ErdRelationEdge,
};

/** 노드 수가 임계치를 넘으면 MiniMap을 자동 숨김하여 드래그 성능을 우선한다. */
const MINIMAP_NODE_LIMIT = 80;
const EMPTY_EDGE_LOCKS = new Map();
const EMPTY_EDGE_PREVIEWS = new Map();

function isFiniteCanvasPosition(
  position: { x: number; y: number } | null | undefined,
): position is { x: number; y: number } {
  return !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
}

function areRoutePointsEqual(left: Waypoint[], right: Waypoint[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((point, index) => point.x === right[index]?.x && point.y === right[index]?.y);
}

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
  /** 사전 관리 다이얼로그 열림 여부 */
  dictionaryOpen?: boolean;
  /** 사전 관리 다이얼로그 열기 핸들러 */
  onOpenDictionary?: () => void;
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
  /** code 모드 shared draft overlay 그래프 */
  draftOverlayGraph?: PreviewDraftOverlayGraph | null;
  /** 코드 에디터 테이블 포커스 요청 */
  tableFocusRequest?: CodeEditorTableFocusRequest | null;
  /** 테이블 정의서 엑셀 다운로드 핸들러 */
  onExportTableDefinition?: (content: string) => Promise<void> | void;
  /** 컬럼 정의서 엑셀 다운로드 핸들러 */
  onExportColumnDefinition?: (content: string) => Promise<void> | void;
  /** 인덱스 정의서 엑셀 다운로드 핸들러 */
  onExportIndexDefinition?: (content: string) => Promise<void> | void;
  /** 테이블 정의서 엑셀 다운로드 진행 여부 */
  tableDefinitionExporting?: boolean;
  /** 컬럼 정의서 엑셀 다운로드 진행 여부 */
  columnDefinitionExporting?: boolean;
  /** 인덱스 정의서 엑셀 다운로드 진행 여부 */
  indexDefinitionExporting?: boolean;
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
  dictionaryOpen,
  onOpenDictionary,
  canEdit = true,
  codeEditorActive,
  onToggleCodeEditor,
  isSidebarResizing = false,
  activeGroupId,
  activeGroupName,
  activeGroupTableIds,
  draftOverlayGraph,
  tableFocusRequest,
  onExportTableDefinition,
  tableDefinitionExporting = false,
  onExportColumnDefinition,
  columnDefinitionExporting = false,
  onExportIndexDefinition,
  indexDefinitionExporting = false,
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
  const updateEdgeRoutingType = useCanvasStore((s) => s.updateEdgeRoutingType);
  const updateEdgeHandleSelection = useCanvasStore((s) => s.updateEdgeHandleSelection);
  const updateEdgeWaypoints = useCanvasStore((s) => s.updateEdgeWaypoints);
  const resetEdgeWaypoints = useCanvasStore((s) => s.resetEdgeWaypoints);
  const normalizeEdgeHandles = useCanvasStore((s) => s.normalizeEdgeHandles);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const finalizeNodeDrag = useCanvasStore((s) => s.finalizeNodeDrag);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const stopHistoryCapture = useCanvasStore((s) => s.stopHistoryCapture);
  const setActiveEditNodeId = useCanvasStore((s) => s.setActiveEditNodeId);
  const localEdgeDrag = useCollaborationStore((s) => s.localEdgeDrag);
  const setLocalEdgeDrag = useCollaborationStore((s) => s.setLocalEdgeDrag);
  const updateLocalEdgeDragPreview = useCollaborationStore((s) => s.updateLocalEdgeDragPreview);
  const clearLocalEdgeDrag = useCollaborationStore((s) => s.clearLocalEdgeDrag);
  const remoteEditLocks = useRemoteEditLocks();
  const { locksByNodeId } = remoteEditLocks;
  const localEdgeDragRef = useRef(localEdgeDrag);
  const headerZoomCompensationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedHeaderZoomRef = useRef<number | null>(null);
  const lastHandledTableFocusRequestIdRef = useRef<number | null>(null);
  const applyZoomTextCompensation = useCallback((zoom: number) => {
    applyHeaderZoomCssVariables(canvasRef.current, zoom);
    lastAppliedHeaderZoomRef.current = zoom;
  }, []);
  const clearZoomCompensationTimer = useCallback(() => {
    if (headerZoomCompensationTimerRef.current) {
      clearTimeout(headerZoomCompensationTimerRef.current);
      headerZoomCompensationTimerRef.current = null;
    }
  }, []);
  const scheduleZoomTextCompensation = useCallback(
    (zoom: number) => {
      clearZoomCompensationTimer();
      headerZoomCompensationTimerRef.current = setTimeout(() => {
        applyZoomTextCompensation(zoom);
        headerZoomCompensationTimerRef.current = null;
      }, TABLE_HEADER_ZOOM_COMPENSATION_DELAY_MS);
    },
    [applyZoomTextCompensation, clearZoomCompensationTimer],
  );

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

  const handleExportTableDefinition = useCallback(() => {
    if (!onExportTableDefinition) {
      return;
    }
    void onExportTableDefinition(
      serializeDiagramDefinitionExportContent(nodes as ERDTableNode[], edges as ERDEdge[]),
    );
  }, [edges, nodes, onExportTableDefinition]);
  const handleExportColumnDefinition = useCallback(() => {
    if (!onExportColumnDefinition) {
      return;
    }
    void onExportColumnDefinition(
      serializeDiagramDefinitionExportContent(nodes as ERDTableNode[], edges as ERDEdge[]),
    );
  }, [edges, nodes, onExportColumnDefinition]);
  const handleExportIndexDefinition = useCallback(() => {
    if (!onExportIndexDefinition) {
      return;
    }
    void onExportIndexDefinition(
      serializeDiagramDefinitionExportContent(nodes as ERDTableNode[], edges as ERDEdge[]),
    );
  }, [edges, nodes, onExportIndexDefinition]);
  const { exportPng, exportJpg, exportSvg, exportPdf, exportProgress } =
    useExportDiagram(diagramName);

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
  /** 마지막으로 fitView 적용한 draft overlay 그래프 시그니처 */
  const lastDraftOverlayFitSignatureRef = useRef<string | null>(null);
  const manualViewportInteractionRef = useRef(false);
  const autoFitViewportMovePendingRef = useRef(false);

  /** 그룹 뷰 활성 여부 */
  const isGroupView = !!activeGroupId && !!activeGroupTableIds;
  /** 그룹 뷰에서는 모든 편집 기능을 차단한다. */
  const effectiveCanEdit = canEdit && !isGroupView;

  /** 그룹 뷰일 때 필터링된 노드, 아닐 때 전체 노드 */
  const displayNodes = useMemo(() => {
    const overlayNodes = draftOverlayGraph?.nodes ?? [];
    if (!activeGroupTableIds) {
      return [...nodes, ...overlayNodes];
    }
    return [
      ...nodes.filter((node) => activeGroupTableIds.has(node.id)),
      ...overlayNodes,
    ];
  }, [nodes, activeGroupTableIds, draftOverlayGraph?.nodes]);

  /** 그룹 뷰일 때 양쪽 노드가 모두 속한 엣지만 노출한다. */
  const displayEdges = useMemo(() => {
    const overlayEdges = draftOverlayGraph?.edges ?? [];
    if (!activeGroupTableIds) {
      return [...edges, ...overlayEdges];
    }
    return [
      ...edges.filter(
        (edge) => activeGroupTableIds.has(edge.source) && activeGroupTableIds.has(edge.target),
      ),
      ...overlayEdges,
    ];
  }, [edges, activeGroupTableIds, draftOverlayGraph?.edges]);

  const contextMenuEdge = useMemo(
    () => (contextMenu ? edges.find((edge) => edge.id === contextMenu.edgeId) ?? null : null),
    [contextMenu, edges],
  );
  const contextMenuSourceNode = useMemo(
    () => (contextMenuEdge ? nodes.find((node) => node.id === contextMenuEdge.source) ?? null : null),
    [contextMenuEdge, nodes],
  );
  const contextMenuTargetNode = useMemo(
    () => (contextMenuEdge ? nodes.find((node) => node.id === contextMenuEdge.target) ?? null : null),
    [contextMenuEdge, nodes],
  );
  const contextMenuHandleSelection = useMemo(() => {
    if (!contextMenuEdge) {
      return 'auto';
    }
    return getCurrentEdgeHandleSelectionValue({
      handleMode: (
        contextMenuEdge.data as { handleMode?: 'auto' | 'manual' } | undefined
      )?.handleMode,
      sourceSide: (
        contextMenuEdge.data as { sourceSide?: 'left' | 'right' } | undefined
      )?.sourceSide,
      targetSide: (
        contextMenuEdge.data as { targetSide?: 'left' | 'right' } | undefined
      )?.targetSide,
      sourceHandle: contextMenuEdge.sourceHandle,
      targetHandle: contextMenuEdge.targetHandle,
    });
  }, [contextMenuEdge]);
  const contextMenuAllowedHandleSelections = useMemo(() => {
    return getAllowedEdgeHandleSelectionValues(
      contextMenuSourceNode?.data.handleLayout,
      contextMenuTargetNode?.data.handleLayout,
    );
  }, [contextMenuSourceNode, contextMenuTargetNode]);

  useEffect(() => {
    localEdgeDragRef.current = localEdgeDrag;
  }, [localEdgeDrag]);

  useEffect(() => {
    applyZoomTextCompensation(reactFlowInstance.getZoom());
  }, [applyZoomTextCompensation, reactFlowInstance]);

  useEffect(() => {
    return () => {
      clearZoomCompensationTimer();
    };
  }, [clearZoomCompensationTimer]);

  useEffect(() => {
    const overlayNodes = draftOverlayGraph?.nodes ?? [];
    if (overlayNodes.length === 0) {
      lastDraftOverlayFitSignatureRef.current = null;
      return;
    }

    const overlaySignature = JSON.stringify({
      nodes: overlayNodes.map((node) => node.id),
      edges: (draftOverlayGraph?.edges ?? []).map((edge) => edge.id),
    });

    if (lastDraftOverlayFitSignatureRef.current === overlaySignature) {
      return;
    }

    if (manualViewportInteractionRef.current) {
      return;
    }

    lastDraftOverlayFitSignatureRef.current = overlaySignature;
    requestAnimationFrame(() => {
      autoFitViewportMovePendingRef.current = true;
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    });
  }, [draftOverlayGraph?.edges, draftOverlayGraph?.nodes, reactFlowInstance]);

  // 그룹 뷰 전환 시 필터링된 노드에 맞춰 뷰포트를 보정한다.
  useEffect(() => {
    if (!isGroupView || displayNodes.length === 0) {
      return;
    }
    requestAnimationFrame(() => {
      autoFitViewportMovePendingRef.current = true;
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
    const edgeLockInfo = remoteEditLocks.edgeLocksById.get(edgeId);
    if (edgeLockInfo) {
      toast.info(t('erd.edge.blockedEditToast', { name: edgeLockInfo.name }));
      return;
    }
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

  const finishLocalEdgeDrag = useCallback(
    (commit: boolean) => {
      const drag = localEdgeDragRef.current;
      if (!drag) {
        return;
      }
      if (commit) {
        const edge = useCanvasStore.getState().edges.find((candidate) => candidate.id === drag.edgeId);
        const routingType =
          ((edge?.data as { routingType?: EdgeRoutingType } | undefined)?.routingType ??
            'smoothstep') as EdgeRoutingType;
        if (edge && routingType === 'straight') {
          updateEdgeWaypoints(drag.edgeId, drag.previewWaypoints);
        }
      }
      clearLocalEdgeDrag();
    },
    [clearLocalEdgeDrag, updateEdgeWaypoints],
  );

  const beginSegmentDrag = useCallback(
    ({ edgeId, pointerId, segmentIndex, axis, kind, routePoints, waypoints }: BeginSegmentDragParams) => {
      const edgeLockInfo = remoteEditLocks.edgeLocksById.get(edgeId);
      if (edgeLockInfo) {
        toast.info(t('erd.edge.blockedEditToast', { name: edgeLockInfo.name }));
        return;
      }
      const edge = edges.find((candidate) => candidate.id === edgeId);
      setActiveEditNodeId(null);
      lastBlockedNodeRef.current = null;
      if (edge) {
        setHighlightedEdge(edge.id);
        setHighlightedNodes([edge.source, edge.target]);
      }
      setLocalEdgeDrag({
        edgeId,
        pointerId,
        segmentIndex,
        axis,
        kind,
        routePoints,
        initialWaypoints: waypoints,
        previewWaypoints: waypoints,
      });
    },
    [
      edges,
      remoteEditLocks.edgeLocksById,
      setActiveEditNodeId,
      setHighlightedEdge,
      setHighlightedNodes,
      setLocalEdgeDrag,
      t,
    ],
  );

  const splitSegment = useCallback(
    ({ edgeId, segmentIndex, routePoints, clickPoint }: SplitSegmentParams) => {
      const edgeLockInfo = remoteEditLocks.edgeLocksById.get(edgeId);
      if (edgeLockInfo) {
        toast.info(t('erd.edge.blockedEditToast', { name: edgeLockInfo.name }));
        return;
      }
      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return;
      }
      setActiveEditNodeId(null);
      lastBlockedNodeRef.current = null;
      setHighlightedEdge(edge.id);
      setHighlightedNodes([edge.source, edge.target]);
      const nextRoutePoints = toggleOrthogonalSegmentDetail(routePoints, segmentIndex, clickPoint);
      if (areRoutePointsEqual(nextRoutePoints, routePoints)) {
        return;
      }
      clearLocalEdgeDrag();
      updateEdgeWaypoints(edgeId, routePointsToWaypoints(nextRoutePoints));
    },
    [
      clearLocalEdgeDrag,
      edges,
      remoteEditLocks.edgeLocksById,
      setActiveEditNodeId,
      setHighlightedEdge,
      setHighlightedNodes,
      t,
      updateEdgeWaypoints,
    ],
  );

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
    setHighlightedEdge(edge.id);
    setHighlightedNodes([edge.source, edge.target]);
    setContextMenu({ edgeId: edge.id, position: { x: event.clientX, y: event.clientY } });
  };

  useEffect(() => {
    if (!localEdgeDrag) {
      return;
    }

    const handlePointerMove = (event: MouseEvent | PointerEvent) => {
      const drag = localEdgeDragRef.current;
      if (!drag) {
        return;
      }
      const nextPoint = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const nextRoutePoints = shiftOrthogonalSegment(
        drag.routePoints,
        drag.segmentIndex,
        drag.axis === 'x' ? nextPoint.x : nextPoint.y,
      );
      const nextWaypoints = routePointsToWaypoints(nextRoutePoints);
      localEdgeDragRef.current = {
        ...drag,
        routePoints: nextRoutePoints,
        previewWaypoints: nextWaypoints,
      };
      updateLocalEdgeDragPreview(nextWaypoints, nextRoutePoints);
    };

    const handlePointerUp = () => {
      if (!localEdgeDragRef.current) {
        return;
      }
      finishLocalEdgeDrag(true);
    };

    const handlePointerCancel = () => {
      if (!localEdgeDragRef.current) {
        return;
      }
      finishLocalEdgeDrag(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finishLocalEdgeDrag(false);
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    clearLocalEdgeDrag,
    finishLocalEdgeDrag,
    localEdgeDrag,
    reactFlowInstance,
    updateLocalEdgeDragPreview,
  ]);

  useEffect(() => {
    if (!tableFocusRequest) {
      return;
    }
    if (lastHandledTableFocusRequestIdRef.current === tableFocusRequest.requestId) {
      return;
    }

    const targetNode = findPersistedTableNodeForFocus(nodes as ERDTableNode[], tableFocusRequest);
    if (!targetNode) {
      return;
    }
    lastHandledTableFocusRequestIdRef.current = tableFocusRequest.requestId;

    const reactFlowNode = reactFlowInstance.getNode(targetNode.id) as Node<TableNodeData> | undefined;
    const width = reactFlowNode?.width ?? 420;
    const height = reactFlowNode?.height ?? 80;
    setHighlightedEdge(null);
    setHighlightedNodes([targetNode.id]);
    autoFitViewportMovePendingRef.current = true;
    reactFlowInstance.setCenter(targetNode.position.x + width / 2, targetNode.position.y + height / 2, {
      duration: 300,
      zoom: Math.max(reactFlowInstance.getZoom(), 0.8),
    });
  }, [nodes, reactFlowInstance, setHighlightedEdge, setHighlightedNodes, tableFocusRequest]);

  useEffect(() => {
    if (!localEdgeDrag) {
      return;
    }
    const edge = edges.find((candidate) => candidate.id === localEdgeDrag.edgeId);
    const routingType =
      ((edge?.data as { routingType?: EdgeRoutingType } | undefined)?.routingType ??
        'smoothstep') as EdgeRoutingType;
    if (edge && routingType === 'straight') {
      return;
    }
    clearLocalEdgeDrag();
    toast.info(t('erd.edge.editCancelledBySync'));
  }, [clearLocalEdgeDrag, edges, localEdgeDrag, t]);

  /**
   * 자동 배치를 실행한다.
   *
   * @returns 없음
   */
  const handleAutoLayout = () => {
    const layoutedNodes = applyDagreLayout(nodes, edges);
    applyLayout(layoutedNodes);
    requestAnimationFrame(() => {
      normalizeEdgeHandles(
        undefined,
        reactFlowInstance.getNodes() as Node<TableNodeData>[],
        CANVAS_HISTORY_ORIGIN.USER_LAYOUT,
      );
    });
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

  const tableLockContextValue = useMemo(
    () => ({
      locksByTableKey: remoteEditLocks.locksByTableKey,
      locksByNodeId: remoteEditLocks.locksByNodeId,
      edgeLocksById: EMPTY_EDGE_LOCKS,
      edgePreviewsById: EMPTY_EDGE_PREVIEWS,
      hasTableLocks: remoteEditLocks.hasTableLocks,
      hasAnyActiveEdgeDrag: false,
      hasBlockingStructureLocks: remoteEditLocks.hasTableLocks,
    }),
    [remoteEditLocks.hasTableLocks, remoteEditLocks.locksByNodeId, remoteEditLocks.locksByTableKey],
  );

  const edgeEditingContextValue = useMemo(
    () => ({
      edgeLocksById: remoteEditLocks.edgeLocksById,
      edgePreviewsById: remoteEditLocks.edgePreviewsById,
      localEdgeDrag,
      beginSegmentDrag,
      splitSegment,
    }),
    [
      beginSegmentDrag,
      localEdgeDrag,
      remoteEditLocks.edgeLocksById,
      remoteEditLocks.edgePreviewsById,
      splitSegment,
    ],
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
        <RemoteEditLocksProvider value={tableLockContextValue}>
      <EdgeEditingProvider value={edgeEditingContextValue}>
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
                ? (_event, node) => {
                    setIsDraggingNode(false);
                    requestAnimationFrame(() => {
                      const latestNode =
                        (reactFlowInstance.getNode(node.id) as Node<TableNodeData> | undefined) ??
                        node;
                      const storeNode = useCanvasStore
                        .getState()
                        .nodes.find((candidate) => candidate.id === node.id) as
                        | Node<TableNodeData>
                        | undefined;
                      const resolvedPosition = isFiniteCanvasPosition(latestNode.position)
                        ? latestNode.position
                        : isFiniteCanvasPosition(node.position)
                          ? node.position
                          : isFiniteCanvasPosition(storeNode?.position)
                            ? storeNode.position
                            : null;
                      if (!resolvedPosition) {
                        return;
                      }
                      const normalizedNode =
                        latestNode.position.x === resolvedPosition.x &&
                        latestNode.position.y === resolvedPosition.y
                          ? latestNode
                          : { ...latestNode, position: resolvedPosition };
                      finalizeNodeDrag([
                        {
                          nodeId: latestNode.id,
                          position: resolvedPosition,
                        },
                      ]);
                      normalizeEdgeHandles([node.id], [normalizedNode], DRAG_TRANSACTION_ORIGIN);
                      stopHistoryCapture();
                    });
                  }
                : undefined
            }
            onEdgeClick={handleEdgeClick}
            onEdgeContextMenu={effectiveCanEdit ? handleEdgeContextMenu : undefined}
            onPaneClick={handlePaneClick}
            onInit={(instance) => {
              applyZoomTextCompensation(instance.getZoom());
            }}
            onMoveEnd={(_event, viewport) => {
              const autoFitMovePending = autoFitViewportMovePendingRef.current;
              autoFitViewportMovePendingRef.current = false;
              if (!autoFitMovePending) {
                manualViewportInteractionRef.current = true;
              }
              const lastAppliedZoom = lastAppliedHeaderZoomRef.current;
              if (
                lastAppliedZoom != null &&
                Math.abs(viewport.zoom - lastAppliedZoom) <= TABLE_HEADER_ZOOM_CHANGE_EPSILON
              ) {
                return;
              }
              scheduleZoomTextCompensation(viewport.zoom);
            }}
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
              onExportTableDefinition={handleExportTableDefinition}
              onExportColumnDefinition={handleExportColumnDefinition}
              onExportIndexDefinition={handleExportIndexDefinition}
              onExportDdl={() => setDdlDialogOpen(true)}
              onImportDdl={() => setDdlImportOpen(true)}
              codeEditorActive={codeEditorActive}
              onToggleCodeEditor={onToggleCodeEditor}
              validationOpen={validationOpen}
              onToggleValidation={onToggleValidation}
              dictionaryOpen={dictionaryOpen}
              onOpenDictionary={onOpenDictionary}
              canUndo={effectiveCanEdit && canUndo}
              canRedo={effectiveCanEdit && canRedo}
              onUndo={undo}
              onRedo={redo}
              canEdit={effectiveCanEdit}
              isExporting={
                exportProgress.isExporting ||
                tableDefinitionExporting ||
                columnDefinitionExporting ||
                indexDefinitionExporting
              }
            />
            </ReactFlow>
          </EdgeEditingProvider>
        </RemoteEditLocksProvider>
      </ErdFkModeProvider>

      <ExportProgressDialog progress={exportProgress} />

      {showPerformanceOverlays && <RemoteCursors />}

      {contextMenu && contextMenuEdge && (
        <EdgeContextMenu
          position={contextMenu.position}
          routingType={
            ((contextMenuEdge.data as { routingType?: EdgeRoutingType } | undefined)?.routingType ??
              'smoothstep') as EdgeRoutingType
          }
          handleSelection={contextMenuHandleSelection}
          allowedHandleSelections={contextMenuAllowedHandleSelections}
          canResetPath={
            (((contextMenuEdge.data as { routingType?: EdgeRoutingType } | undefined)?.routingType ??
              'smoothstep') as EdgeRoutingType) === 'straight' &&
            (((contextMenuEdge.data as { waypoints?: Waypoint[] } | undefined)?.waypoints?.length ?? 0) >
              0)
          }
          onResetPath={() => {
            if (remoteEditLocks.edgeLocksById.has(contextMenu.edgeId)) {
              return;
            }
            resetEdgeWaypoints(contextMenu.edgeId);
            setContextMenu(null);
          }}
          lockedByName={remoteEditLocks.edgeLocksById.get(contextMenu.edgeId)?.name ?? null}
          onRoutingTypeChange={(routingType) => {
            if (remoteEditLocks.edgeLocksById.has(contextMenu.edgeId)) {
              return;
            }
            updateEdgeRoutingType(contextMenu.edgeId, routingType);
            setContextMenu(null);
          }}
          onHandleSelectionChange={(selection) => {
            if (remoteEditLocks.edgeLocksById.has(contextMenu.edgeId)) {
              return;
            }
            const nodeOverrides = [
              reactFlowInstance.getNode(contextMenuEdge.source),
              reactFlowInstance.getNode(contextMenuEdge.target),
            ].filter(
              (node): node is Node<TableNodeData> => !!node,
            );
            updateEdgeHandleSelection(contextMenu.edgeId, selection, nodeOverrides);
            setContextMenu(null);
          }}
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
