import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type EdgeTypes,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type XYPosition,
  useStore,
} from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useErdDictionary } from './ErdDictionaryContext';
import type { DslPreviewCanvasState, DslPreviewNode } from '@/lib/dsl-preview-graph';
import { getColumnWarning } from '@/hooks/useColumnValidation';
import TableNodeHeader from './TableNodeHeader';
import StaticColumnRow from './StaticColumnRow';
import ErdRelationEdge from './ErdRelationEdge';

/** preview 캔버스에서 MiniMap을 숨길 노드 수 임계치 */
const PREVIEW_MINIMAP_NODE_LIMIT = 80;

/**
 * preview 테이블 노드에서 연결된 핸들을 수집한다.
 *
 * @param nodeId preview 노드 ID
 * @returns 연결된 핸들 ID 집합
 */
function useConnectedHandles(nodeId: string): Set<string> {
  return useStore(
    (state) => {
      const handleIds = new Set<string>();
      const prefix = `${nodeId}-`;
      for (const edge of state.edges) {
        if (edge.sourceHandle?.startsWith(prefix)) {
          handleIds.add(edge.sourceHandle);
        }
        if (edge.targetHandle?.startsWith(prefix)) {
          handleIds.add(edge.targetHandle);
        }
      }
      return handleIds;
    },
    (left, right) => {
      if (left.size !== right.size) {
        return false;
      }
      for (const value of left) {
        if (!right.has(value)) {
          return false;
        }
      }
      return true;
    },
  );
}

/**
 * code 모드 전용 read-only preview 테이블 노드.
 *
 * @param props React Flow 노드 props
 * @returns preview 테이블 노드 JSX
 */
function PreviewTableNode({ id, data }: NodeProps<DslPreviewNode>) {
  const { findDomainById, findTermById, resolveLogicalName } = useErdDictionary();
  const connectedHandles = useConnectedHandles(id);

  const duplicatedLogicalNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const column of data.columns) {
      const key = column.logicalName?.trim();
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([logicalName]) => logicalName),
    );
  }, [data.columns]);

  /**
   * 컬럼이 관계선에 연결되어 있는지 판정한다.
   *
   * @param columnId preview 컬럼 ID
   * @returns 연결 여부
   */
  const isConnected = (columnId: string): boolean => {
    const prefix = `${id}-${columnId}-`;
    for (const handleId of connectedHandles) {
      if (handleId.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-card border border-border rounded shadow-md w-max min-w-[420px]">
        <TableNodeHeader
          label={data.label}
          logicalTableName={data.logicalTableName}
          tableTermId={data.tableTermId}
          headerColor={data.headerColor}
          handleLayout={data.handleLayout}
          isEditing={false}
          duplicateLogicalNameColumnCount={0}
          lockInfo={undefined}
          onLogicalNameChange={() => {}}
          onSelectTerm={() => {}}
          onSelectDerived={() => {}}
          onRegisterNew={() => {}}
          onRename={() => {}}
          onColorChange={() => {}}
          onHandleLayoutChange={() => {}}
        />

        <div className="divide-y divide-border">
          {data.columns.map((column) => {
            const resolution = column.logicalName ? resolveLogicalName(column.logicalName) : null;
            const resolvedDomain =
              column.domainId != null
                ? findDomainById(column.domainId)
                : resolution?.domainId
                  ? findDomainById(resolution.domainId)
                  : undefined;

            return (
              <StaticColumnRow
                key={column.id}
                col={column}
                nodeId={id}
                connected={isConnected(column.id)}
                handleLayout={data.handleLayout ?? 'split'}
                warning={getColumnWarning(column, findTermById, findDomainById, resolveLogicalName)}
                hasDuplicateLogicalName={
                  !!column.logicalName?.trim() &&
                  duplicatedLogicalNames.has(column.logicalName.trim())
                }
                domainLogicalName={resolvedDomain?.logicalName}
                domainPhysicalType={resolvedDomain?.physicalType}
              />
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

const previewNodeTypes: NodeTypes = {
  previewTable: memo(PreviewTableNode),
};

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

interface PreviewCanvasProps {
  /** DSL preview 상태 */
  previewState: DslPreviewCanvasState | null;
}

/**
 * preview 노드에 로컬 위치 override를 병합한다.
 *
 * code 모드에서 사용자가 드래그한 위치를 유지하되, 실제 persisted ERD는 건드리지 않는다.
 *
 * @param nodes incoming preview 노드 목록
 * @param positionOverrides 로컬 위치 override 맵
 * @returns 화면 표시용 preview 노드 목록
 */
function mergePreviewNodesWithLocalOverrides(
  nodes: readonly DslPreviewNode[],
  positionOverrides: ReadonlyMap<string, XYPosition>,
): DslPreviewNode[] {
  return nodes.map((node) => ({
    ...node,
    position: positionOverrides.get(node.id) ?? node.position,
  }));
}

/**
 * code 모드에서 DSL parse 결과를 읽기 전용 그래프로 보여주는 preview 캔버스.
 *
 * @param props.previewState 현재 DSL preview 상태
 * @returns read-only preview canvas JSX
 */
export default function PreviewCanvas({ previewState }: PreviewCanvasProps) {
  const { t } = useTranslation();
  const message = resolvePreviewMessage(t, previewState);
  const graph = previewState?.graph;
  const hasGraph = !!graph && graph.nodes.length > 0;
  const [displayNodes, setDisplayNodes] = useState<DslPreviewNode[]>([]);
  const positionOverridesRef = useRef<Map<string, XYPosition>>(new Map());

  useEffect(() => {
    if (!graph) {
      positionOverridesRef.current.clear();
      setDisplayNodes([]);
      return;
    }

    const nextNodeIds = new Set(graph.nodes.map((node) => node.id));
    for (const nodeId of Array.from(positionOverridesRef.current.keys())) {
      if (!nextNodeIds.has(nodeId)) {
        positionOverridesRef.current.delete(nodeId);
      }
    }

    setDisplayNodes(
      mergePreviewNodesWithLocalOverrides(graph.nodes, positionOverridesRef.current),
    );
  }, [graph]);

  const handleNodesChange = useCallback((changes: NodeChange<DslPreviewNode>[]) => {
    setDisplayNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const handleNodeDragStop = useCallback((_event: unknown, node: DslPreviewNode) => {
    positionOverridesRef.current.set(node.id, node.position);
  }, []);

  return (
    <div className="h-full w-full bg-background relative">
      {hasGraph ? (
        <ReactFlow
          nodes={displayNodes}
          edges={graph!.edges}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={previewNodeTypes}
          edgeTypes={previewEdgeTypes}
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
