import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  type NodeChange,
  type EdgeTypes,
} from '@xyflow/react';
import { BookText, Download, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ExportProgressDialog from './ExportProgressDialog';
import type { DslPreviewCanvasState, DslPreviewNode } from '@/lib/dsl-preview-graph';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import type { CodeEditorTableFocusRequest } from '@/lib/code-editor-table-navigation';
import { findPreviewTableNodeForFocus } from '@/lib/diagram-table-focus';
import { useExportDiagram } from '@/hooks/useExportDiagram';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { ERDEdge, TableNode } from '@/types/erd';
import ErdRelationEdge from './ErdRelationEdge';
import { previewCanvasNodeTypes } from './PreviewTableNodes';
import {
  applyHeaderZoomCssVariables,
  TABLE_HEADER_ZOOM_CHANGE_EPSILON,
  TABLE_HEADER_ZOOM_COMPENSATION_DELAY_MS,
} from './tableHeaderZoom';

/** preview 캔버스에서 MiniMap을 숨길 노드 수 임계치 */
const PREVIEW_MINIMAP_NODE_LIMIT = 80;

const previewEdgeTypes: EdgeTypes = {
  erdRelation: ErdRelationEdge,
};

/**
 * i18n 키를 문자열 메시지로 변환한다.
 *
 * @param t i18n 번역 함수
 * @param key 번역 키
 * @returns 문자열 메시지
 */
function translatePreviewMessage(
  t: TFunction,
  key: string,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return String(t(key as any));
}

/**
 * code 모드 preview 캔버스의 빈 상태/오류 상태 메시지를 계산한다.
 *
 * @param t i18n 번역 함수
 * @param previewState preview 상태
 * @returns 메시지 또는 null
 */
function resolvePreviewMessage(
  t: TFunction,
  previewState: DslPreviewCanvasState | null,
): string | null {
  const hasGraph = !!previewState?.graph && previewState.graph.nodes.length > 0;
  if (previewState?.parsing && !hasGraph) {
    return translatePreviewMessage(t, 'diagram.workMode.codePreviewParsing');
  }
  if (previewState?.hasBlockingErrors && !hasGraph) {
    return translatePreviewMessage(t, 'diagram.workMode.codePreviewBlocked');
  }
  if (!previewState?.hasContent) {
    return translatePreviewMessage(t, 'diagram.workMode.codePreviewEmpty');
  }
  if (!hasGraph) {
    return translatePreviewMessage(t, 'diagram.workMode.codePreviewEmpty');
  }
  return null;
}

/**
 * persisted fallback 사용 중임을 알리는 배너 문구를 계산한다.
 *
 * @param t i18n 번역 함수
 * @param previewState preview 상태
 * @param isUsingPersistedFallback 현재 persisted fallback 사용 여부
 * @returns 안내 문구 또는 null
 */
function resolveFallbackBannerMessage(
  t: TFunction,
  previewState: DslPreviewCanvasState | null,
  isUsingPersistedFallback: boolean,
): string | null {
  if (!isUsingPersistedFallback || previewState?.allowPersistedFallback === false) {
    return null;
  }

  return translatePreviewMessage(t, 'diagram.workMode.codePreviewFallback');
}

interface PreviewCanvasProps {
  /** DSL preview 상태 */
  previewState: DslPreviewCanvasState | null;
  /** export 파일명에 사용할 다이어그램 이름 */
  diagramName: string;
  /** 코드 에디터 테이블 포커스 요청 */
  tableFocusRequest?: CodeEditorTableFocusRequest | null;
  /** code 모드 로컬 preview 위치 override */
  positionOverrides: DiagramPreviewPositionRecord;
  /** code 모드 로컬 preview 위치 override 변경 핸들러 */
  onPositionOverridesChange: (next: DiagramPreviewPositionRecord) => void;
  /** 사전 관리 진입 허용 여부 */
  canOpenDictionary: boolean;
  /** 사전 관리 열기 핸들러 */
  onOpenDictionary?: () => void;
}

interface PreviewCanvasToolbarProps {
  /** export 파일명에 사용할 다이어그램 이름 */
  diagramName: string;
  /** 로컬 preview 위치를 기본 배치로 되돌린다. */
  onResetLayout: () => void;
  /** preview 그래프가 있는지 여부 */
  hasGraph: boolean;
  /** 사전 관리 진입 허용 여부 */
  canOpenDictionary: boolean;
  /** 사전 관리 열기 핸들러 */
  onOpenDictionary?: () => void;
}

/**
 * code 모드 preview 상단 액션 바.
 *
 * code 모드에서 preview 전용 액션만 제공한다.
 * 현재는 위치 초기화, export, 사전 관리 진입을 지원한다.
 *
 * @param props.diagramName export 파일명
 * @param props.onResetLayout preview 배치 초기화 핸들러
 * @param props.hasGraph preview 그래프 존재 여부
 * @param props.canOpenDictionary 사전 관리 진입 허용 여부
 * @param props.onOpenDictionary 사전 관리 열기 핸들러
 * @returns preview 툴바 JSX
 */
function PreviewCanvasToolbar({
  diagramName,
  onResetLayout,
  hasGraph,
  canOpenDictionary,
  onOpenDictionary,
}: PreviewCanvasToolbarProps) {
  const { t } = useTranslation();
  const { exportPng, exportJpg, exportSvg, exportPdf, exportProgress } = useExportDiagram(diagramName);

  return (
    <>
      <Panel position="top-center">
        <div className="bg-card border border-border rounded-lg shadow-md p-1 gap-1 flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetLayout}
            className="gap-1.5"
            aria-label={t('erd.toolbar.autoLayout')}
            disabled={!hasGraph}
          >
            <LayoutGrid className="h-4 w-4" />
            {t('erd.toolbar.autoLayout')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                aria-label={
                  exportProgress.isExporting
                    ? t('erd.toolbar.exporting')
                    : t('erd.toolbar.export')
                }
                disabled={exportProgress.isExporting}
              >
                <Download className="h-4 w-4" />
                {exportProgress.isExporting ? t('erd.toolbar.exporting') : t('erd.toolbar.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportPng} disabled={exportProgress.isExporting}>
                PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJpg} disabled={exportProgress.isExporting}>
                JPG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportSvg} disabled={exportProgress.isExporting}>
                SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf} disabled={exportProgress.isExporting}>
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            aria-label={t('erd.toolbar.dictionary')}
            onClick={onOpenDictionary}
            disabled={!canOpenDictionary || !onOpenDictionary}
          >
            <BookText className="h-4 w-4" />
            {t('erd.toolbar.dictionary')}
          </Button>
        </div>
      </Panel>
      <ExportProgressDialog progress={exportProgress} />
    </>
  );
}

/**
 * preview 노드에 로컬 위치 override를 병합한다.
 *
 * code 모드에서 사용자가 드래그한 위치를 유지한다.
 *
 * @param nodes incoming preview 노드 목록
 * @param positionOverrides 로컬 위치 override 맵
 * @returns 화면 표시용 preview 노드 목록
 */
function mergePreviewNodesWithLocalOverrides(
  nodes: readonly DslPreviewNode[],
  positionOverrides: DiagramPreviewPositionRecord,
): DslPreviewNode[] {
  return nodes.map((node) => ({
    ...node,
    position: positionOverrides[node.id] ?? node.position,
  }));
}

/**
 * persisted ERD 테이블 노드를 preview 전용 노드로 변환한다.
 *
 * code 모드 preview가 아직 준비되지 않았거나 일시적으로 비어 있을 때도
 * 사용자가 기존 published 다이어그램을 계속 볼 수 있도록 한다.
 *
 * @param nodes persisted ERD 노드 목록
 * @returns preview 렌더용 노드 목록
 */
function buildPreviewFallbackNodes(nodes: readonly TableNode[]): DslPreviewNode[] {
  return nodes
    .filter((node) => node.type === 'table')
    .map((node) => ({
      ...node,
      type: 'previewTable',
      height: node.height ?? (52 + node.data.columns.length * 30),
    }));
}

/**
 * code 모드에서 DSL parse 결과를 읽기 전용 그래프로 보여주는 preview 캔버스.
 *
 * @param props.previewState 현재 DSL preview 상태
 * @param props.diagramName export 파일명에 사용할 다이어그램 이름
 * @param props.positionOverrides code 모드 로컬 preview 위치 override
 * @param props.onPositionOverridesChange code 모드 로컬 preview 위치 override 변경 핸들러
 * @param props.canOpenDictionary 사전 관리 진입 허용 여부
 * @param props.onOpenDictionary 사전 관리 열기 핸들러
 * @returns read-only preview canvas JSX
 */
export default function PreviewCanvas({
  previewState,
  diagramName,
  tableFocusRequest,
  positionOverrides,
  onPositionOverridesChange,
  canOpenDictionary,
  onOpenDictionary,
}: PreviewCanvasProps) {
  const { t } = useTranslation();
  const { persistedNodes, persistedEdges } = useCanvasStore(
    useShallow((state) => ({
      persistedNodes: state.nodes as TableNode[],
      persistedEdges: state.edges as ERDEdge[],
    })),
  );
  const graph = previewState?.graph;
  const canUsePersistedFallback = previewState?.allowPersistedFallback ?? true;
  const fallbackGraph = useMemo(
    () => ({
      nodes: buildPreviewFallbackNodes(persistedNodes),
      edges: persistedEdges,
    }),
    [persistedEdges, persistedNodes],
  );
  const effectiveGraph =
    graph ?? (canUsePersistedFallback && fallbackGraph.nodes.length > 0 ? fallbackGraph : null);
  const hasGraph = !!effectiveGraph && effectiveGraph.nodes.length > 0;
  const isUsingPersistedFallback = graph == null && effectiveGraph === fallbackGraph && hasGraph;
  const message = hasGraph ? null : resolvePreviewMessage(t, previewState);
  const blockingBannerMessage =
    hasGraph && previewState?.hasBlockingErrors
      ? translatePreviewMessage(t, 'diagram.workMode.codePreviewBlocked')
      : null;
  const fallbackBannerMessage = resolveFallbackBannerMessage(
    t,
    previewState,
    isUsingPersistedFallback,
  );
  const [displayNodes, setDisplayNodes] = useState<DslPreviewNode[]>([]);
  const displayNodesRef = useRef<DslPreviewNode[]>([]);
  const positionOverridesRef = useRef<DiagramPreviewPositionRecord>(positionOverrides);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<DslPreviewNode, ERDEdge> | null>(null);
  const lastHandledFocusRequestIdRef = useRef<number | null>(null);
  const lastFittedGraphSignatureRef = useRef<string | null>(null);
  const manualViewportInteractionRef = useRef(false);
  const autoFitViewportMovePendingRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const headerZoomCompensationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedHeaderZoomRef = useRef<number | null>(null);

  /**
   * preview 캔버스 루트에 zoom 보정 CSS 변수를 즉시 적용한다.
   *
   * @param zoom 현재 React Flow zoom 배율
   * @returns 없음
   */
  const applyZoomTextCompensation = useCallback((zoom: number) => {
    applyHeaderZoomCssVariables(canvasRef.current, zoom);
    lastAppliedHeaderZoomRef.current = zoom;
  }, []);

  /**
   * 예약된 zoom 보정 타이머를 정리한다.
   *
   * @returns 없음
   */
  const clearZoomCompensationTimer = useCallback(() => {
    if (headerZoomCompensationTimerRef.current) {
      clearTimeout(headerZoomCompensationTimerRef.current);
      headerZoomCompensationTimerRef.current = null;
    }
  }, []);

  /**
   * zoom 변경이 확정된 뒤 헤더 보정 CSS 변수를 지연 적용한다.
   *
   * pan 종료처럼 zoom이 그대로인 경우엔 호출하지 않는다.
   *
   * @param zoom 현재 React Flow zoom 배율
   * @returns 없음
   */
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

  useEffect(() => {
    positionOverridesRef.current = positionOverrides;
  }, [positionOverrides]);

  useEffect(() => {
    displayNodesRef.current = displayNodes;
  }, [displayNodes]);

  useEffect(() => {
    return () => {
      clearZoomCompensationTimer();
    };
  }, [clearZoomCompensationTimer]);

  useEffect(() => {
    const sourceGraph = graph ?? (fallbackGraph.nodes.length > 0 ? fallbackGraph : null);
    if (!sourceGraph) {
      setDisplayNodes([]);
      return;
    }

    const nextNodeIds = new Set(sourceGraph.nodes.map((node) => node.id));
    const nextOverrides: DiagramPreviewPositionRecord = {};
    let changed = false;

    for (const [nodeId, position] of Object.entries(positionOverridesRef.current)) {
      if (nextNodeIds.has(nodeId)) {
        nextOverrides[nodeId] = position;
      } else {
        changed = true;
      }
    }

    if (changed) {
      positionOverridesRef.current = nextOverrides;
      onPositionOverridesChange(nextOverrides);
    }

    setDisplayNodes(
      mergePreviewNodesWithLocalOverrides(
        sourceGraph.nodes,
        changed ? nextOverrides : positionOverridesRef.current,
      ),
    );
  }, [fallbackGraph, graph, onPositionOverridesChange, positionOverrides]);

  useEffect(() => {
    if (!effectiveGraph || effectiveGraph.nodes.length === 0) {
      lastFittedGraphSignatureRef.current = null;
      return;
    }

    if (Object.keys(positionOverridesRef.current).length > 0) {
      return;
    }

    if (manualViewportInteractionRef.current) {
      return;
    }

    const graphSignature = JSON.stringify({
      nodes: effectiveGraph.nodes.map((node) => node.id),
      edges: effectiveGraph.edges.map((edge) => edge.id),
    });

    if (lastFittedGraphSignatureRef.current === graphSignature) {
      return;
    }

    lastFittedGraphSignatureRef.current = graphSignature;
    requestAnimationFrame(() => {
      autoFitViewportMovePendingRef.current = true;
      reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    });
  }, [effectiveGraph]);

  /**
   * 드래그가 끝난 preview 노드의 위치를 로컬 override로 저장한다.
   *
   * @param _event React Flow drag stop 이벤트
   * @param node 드래그가 끝난 preview 노드
   * @returns 없음
   */
  const commitPreviewNodePosition = useCallback((node: DslPreviewNode) => {
    const canvasState = useCanvasStore.getState();
    const nextOverrides = { ...positionOverridesRef.current };
    const syncedPreviewNodeIds = canvasState.applyPreviewPositionChangesToPersisted(
      [node],
      { [node.id]: node.position },
    );
    if (syncedPreviewNodeIds.length > 0) {
      delete nextOverrides[node.id];
    } else {
      nextOverrides[node.id] = node.position;
    }
    positionOverridesRef.current = nextOverrides;
    onPositionOverridesChange(nextOverrides);
  }, [onPositionOverridesChange]);

  /**
   * preview 노드 위치 변경을 화면 상태에 반영한다.
   *
   * @param changes React Flow 노드 변경 목록
   * @returns 없음
   */
  const handleNodesChange = useCallback((changes: NodeChange<DslPreviewNode>[]) => {
    const nextNodes = applyNodeChanges(changes, displayNodesRef.current);
    displayNodesRef.current = nextNodes;
    setDisplayNodes(nextNodes);

    for (const change of changes) {
      if (change.type !== 'position' || change.dragging !== false) {
        continue;
      }
      const committedNode = nextNodes.find((candidate) => candidate.id === change.id);
      if (!committedNode) {
        continue;
      }
      commitPreviewNodePosition(committedNode);
    }
  }, [commitPreviewNodePosition]);

  /**
   * 사용자가 조정한 로컬 preview 위치를 기본 배치로 되돌린다.
   *
   * @returns 없음
   */
  const handleResetLayout = useCallback(() => {
    manualViewportInteractionRef.current = false;
    autoFitViewportMovePendingRef.current = true;
    lastFittedGraphSignatureRef.current = null;
    positionOverridesRef.current = {};
    onPositionOverridesChange({});
    setDisplayNodes(effectiveGraph?.nodes ?? []);
    requestAnimationFrame(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    });
  }, [effectiveGraph?.nodes, onPositionOverridesChange]);

  useEffect(() => {
    if (!tableFocusRequest || displayNodes.length === 0) {
      return;
    }
    if (lastHandledFocusRequestIdRef.current === tableFocusRequest.requestId) {
      return;
    }

    const targetNode = findPreviewTableNodeForFocus(displayNodes, tableFocusRequest);
    if (!targetNode) {
      return;
    }
    lastHandledFocusRequestIdRef.current = tableFocusRequest.requestId;

    const reactFlowNode = reactFlowInstanceRef.current?.getNode(targetNode.id);
    const width = reactFlowNode?.width ?? 420;
    const height = reactFlowNode?.height ?? 80;
    autoFitViewportMovePendingRef.current = true;
    reactFlowInstanceRef.current?.setCenter(
      targetNode.position.x + width / 2,
      targetNode.position.y + height / 2,
      {
        duration: 300,
        zoom: Math.max(reactFlowInstanceRef.current?.getZoom() ?? 0.8, 0.8),
      },
    );
  }, [displayNodes, tableFocusRequest]);

  return (
    <div ref={canvasRef} className="h-full w-full bg-background relative">
      <PreviewCanvasToolbar
        diagramName={diagramName}
        onResetLayout={handleResetLayout}
        hasGraph={hasGraph}
        canOpenDictionary={canOpenDictionary}
        onOpenDictionary={onOpenDictionary}
      />

      {hasGraph ? (
        <ReactFlow
          nodes={displayNodes}
          edges={effectiveGraph!.edges}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
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
          onNodesChange={handleNodesChange}
          nodeTypes={previewCanvasNodeTypes}
          edgeTypes={previewEdgeTypes}
          deleteKeyCode={null}
          panActivationKeyCode={null}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          panOnDrag
          zoomOnScroll
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="hsl(var(--muted-foreground) / 0.18)"
          />
          <Controls showInteractive={false} />
          {displayNodes.length <= PREVIEW_MINIMAP_NODE_LIMIT && (
            <MiniMap pannable zoomable />
          )}
        </ReactFlow>
      ) : (
        <div className="h-full w-full bg-background" />
      )}

      {(blockingBannerMessage || fallbackBannerMessage) && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 px-4">
          <div className="rounded-md border border-amber-500/30 bg-background/92 px-3 py-2 text-xs text-amber-700 shadow-sm backdrop-blur dark:text-amber-300">
            {blockingBannerMessage ?? fallbackBannerMessage}
          </div>
        </div>
      )}

      {message && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="rounded-md border border-border bg-background/95 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            {message}
          </div>
        </div>
      )}
    </div>
  );
}
