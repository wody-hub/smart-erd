import { memo, type ReactNode } from 'react';
import { type NodeProps, type NodeTypes, useStore } from '@xyflow/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useErdDictionary } from './ErdDictionaryContext';
import type { DslPreviewNode } from '@/lib/dsl-preview-graph';
import { getColumnWarning } from '@/hooks/useColumnValidation';
import TableNodeHeader from './TableNodeHeader';
import StaticColumnRow from './StaticColumnRow';
import { useDiagramCodeNavigation } from './DiagramCodeNavigationContext';

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
 * preview 테이블 외곽을 렌더한다.
 *
 * @param props.node preview 노드
 * @param props.children 컬럼 row 렌더 결과
 * @param props.ghost ghost 노드 여부
 * @returns preview 테이블 노드 JSX
 */
function PreviewTableNodeFrame({
  node,
  children,
  ghost = false,
}: {
  node: DslPreviewNode;
  children: ReactNode;
  ghost?: boolean;
}) {
  const { canNavigateToCode, navigateToCode } = useDiagramCodeNavigation();

  /**
   * preview 테이블에 대응되는 코드 줄로 이동한다.
   *
   * @returns 없음
   */
  const handleNavigateToCode = () => {
    if (!canNavigateToCode || !navigateToCode || ghost) {
      return;
    }
    navigateToCode({
      requestId: Date.now(),
      physicalName: node.data.label,
      logicalName: node.data.logicalTableName?.trim() || null,
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="w-max min-w-[420px] rounded border border-border bg-card shadow-md"
        style={ghost ? { opacity: 0, pointerEvents: 'none' } : undefined}
      >
        <TableNodeHeader
          label={node.data.label}
          logicalTableName={node.data.logicalTableName}
          tableTermId={node.data.tableTermId}
          headerColor={node.data.headerColor}
          handleLayout={node.data.handleLayout}
          isEditing={false}
          duplicateLogicalNameColumnCount={0}
          lockInfo={undefined}
          onLogicalNameChange={() => {}}
          onSelectTerm={() => {}}
          onSelectDerived={() => {}}
          onRegisterNew={() => {}}
          onNavigateToCode={canNavigateToCode && !ghost ? handleNavigateToCode : undefined}
          onRename={() => {}}
          onColorChange={() => {}}
          onHandleLayoutChange={() => {}}
        />
        <div className="divide-y divide-border">{children}</div>
      </div>
    </TooltipProvider>
  );
}

/**
 * preview 컬럼 row를 읽기 전용으로 렌더한다.
 *
 * @param props React Flow 노드 props
 * @param props.ghost ghost 노드 여부
 * @returns preview 테이블 row JSX
 */
function PreviewTableRows({
  node,
  connectedHandles,
}: {
  node: DslPreviewNode;
  connectedHandles: Set<string>;
}) {
  const { findDomainById, findTermById, resolveLogicalName } = useErdDictionary();
  const counts = new Map<string, number>();
  for (const column of node.data.columns) {
    const key = column.logicalName?.trim();
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicatedLogicalNames = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([logicalName]) => logicalName),
  );

  /**
   * 컬럼이 관계선에 연결되어 있는지 판정한다.
   *
   * @param columnId preview 컬럼 ID
   * @returns 연결 여부
   */
  const isConnected = (columnId: string): boolean => {
    const prefix = `${node.id}-${columnId}-`;
    for (const handleId of connectedHandles) {
      if (handleId.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };

  return (
    <>
      {node.data.columns.map((column) => {
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
            nodeId={node.id}
            connected={isConnected(column.id)}
            handleLayout={node.data.handleLayout ?? 'split'}
            warning={getColumnWarning(
              column,
              findTermById,
              findDomainById,
              resolveLogicalName,
            )}
            hasDuplicateLogicalName={
              !!column.logicalName?.trim() &&
              duplicatedLogicalNames.has(column.logicalName.trim())
            }
            domainLogicalName={resolvedDomain?.logicalName}
            domainPhysicalType={resolvedDomain?.physicalType}
          />
        );
      })}
    </>
  );
}

/**
 * preview 테이블 노드.
 *
 * @param props React Flow 노드 props
 * @returns read-only preview 노드
 */
function PreviewTableNode(props: NodeProps<DslPreviewNode>) {
  const connectedHandles = useConnectedHandles(props.id);
  const node = {
    id: props.id,
    type: 'previewTable' as const,
    position: { x: props.positionAbsoluteX, y: props.positionAbsoluteY },
    data: props.data,
  };
  return (
    <PreviewTableNodeFrame node={node}>
      <PreviewTableRows
        node={node}
        connectedHandles={connectedHandles}
      />
    </PreviewTableNodeFrame>
  );
}

/**
 * persisted 노드 위에 겹쳐지는 invisible preview ghost 노드.
 *
 * draft 전용 관계가 persisted 테이블 핸들 위치를 참조할 수 있게 한다.
 *
 * @param props React Flow 노드 props
 * @returns invisible preview ghost 노드
 */
function PreviewGhostTableNode(props: NodeProps<DslPreviewNode>) {
  const connectedHandles = useConnectedHandles(props.id);
  const node = {
    id: props.id,
    type: 'previewTable' as const,
    position: { x: props.positionAbsoluteX, y: props.positionAbsoluteY },
    data: props.data,
  };
  return (
    <PreviewTableNodeFrame node={node} ghost>
      <PreviewTableRows
        node={node}
        connectedHandles={connectedHandles}
      />
    </PreviewTableNodeFrame>
  );
}

/** persisted/preview canvas 공통 preview node types */
export const previewNodeTypes: NodeTypes = {
  previewTable: memo(PreviewTableNode),
  previewGhostTable: memo(PreviewGhostTableNode),
};
