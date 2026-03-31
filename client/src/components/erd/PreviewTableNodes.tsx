import { memo, useMemo, type ReactNode } from 'react';
import { type NodeProps, type NodeTypes } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useErdDictionary } from './ErdDictionaryContext';
import type { DslPreviewNode } from '@/lib/dsl-preview-graph';
import {
  type WarningValidationStatus,
} from '@/hooks/useColumnValidation';
import TableNodeHeader from './TableNodeHeader';
import StaticColumnRow from './StaticColumnRow';
import { useDiagramCodeNavigation } from './DiagramCodeNavigationContext';
import type { TableNode as PersistedTableNode } from '@/types/erd';
import { getColumnHandlePlacements } from './columnHandleLayout';
import {
  useConnectedColumnDirections,
  useConnectedColumnIds,
} from './ConnectedColumnIdsContext';
import {
  type CompactTableRenderingMode,
  resolvePreviewCompactTableMode,
  useCompactTableRenderingMode,
} from './CompactTableRenderingContext';
import { useTableColumnRenderModel } from './useTableColumnRenderModel';

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
    <div
      data-table-node-kind={ghost ? 'ghost' : 'preview'}
      data-table-name={node.data.label}
      data-table-logical-name={node.data.logicalTableName ?? ''}
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
  connectedColumnIds,
  compactModeOverride,
  ghost = false,
}: {
  node: DslPreviewNode;
  connectedColumnIds: Set<string>;
  compactModeOverride?: CompactTableRenderingMode;
  ghost?: boolean;
}) {
  const { t } = useTranslation();
  const { findDomainById, findTermById, resolveLogicalName } = useErdDictionary();
  const connectedColumnDirections = useConnectedColumnDirections(node.id);
  const compactTableRenderingMode = useCompactTableRenderingMode();
  const compactMode = resolvePreviewCompactTableMode(compactTableRenderingMode, {
    override: compactModeOverride,
    ghost,
  });
  const compactRows = compactMode !== 'off';
  const resolvedHandleLayout = node.data.handleLayout ?? 'split';
  const targetHandlePlacements = useMemo(
    () => getColumnHandlePlacements(resolvedHandleLayout, 'target'),
    [resolvedHandleLayout],
  );
  const sourceHandlePlacements = useMemo(
    () => getColumnHandlePlacements(resolvedHandleLayout, 'source'),
    [resolvedHandleLayout],
  );
  const {
    renderMetaById: columnRenderMetaById,
    validationWarningTextByStatus,
    visibleColumns,
    hiddenUnconnectedColumnCount,
  } = useTableColumnRenderModel({
    columns: node.data.columns,
    connectedColumnIds,
    compactRows,
    t,
    resolveLogicalName,
    findTermById,
    findDomainById,
  });

  return (
    <>
      {visibleColumns.map((column) => {
        const renderMeta = columnRenderMetaById.get(column.id);
        if (!renderMeta) {
          return null;
        }

        return (
          <StaticColumnRow
            key={column.id}
            col={column}
            nodeId={node.id}
            showSourceHandles={connectedColumnDirections.get(column.id)?.source ?? false}
            showTargetHandles={connectedColumnDirections.get(column.id)?.target ?? false}
            targetHandlePlacements={targetHandlePlacements}
            sourceHandlePlacements={sourceHandlePlacements}
            warning={renderMeta.warning}
            validationWarningLabel={
              renderMeta.warning.status
                ? t('erd.tableNode.aria.validationWarning', {
                    name: column.name,
                  })
                : undefined
            }
            validationWarningText={
              renderMeta.warning.status
                ? validationWarningTextByStatus[
                    renderMeta.warning.status as WarningValidationStatus
                  ]
                : undefined
            }
            hasDuplicateLogicalName={renderMeta.hasDuplicateLogicalName}
            duplicateLogicalNameLabel={
              renderMeta.hasDuplicateLogicalName
                ? t('erd.tableNode.aria.duplicateLogicalNameWarning', {
                    name: column.logicalName ?? column.name,
                  })
                : undefined
            }
            duplicateLogicalNameText={
              renderMeta.hasDuplicateLogicalName
                ? t('erd.tableNode.duplicateLogicalNameWarning', {
                    name: column.logicalName ?? column.name,
                  })
                : undefined
            }
            domainLogicalName={renderMeta.domain?.logicalName}
            domainPhysicalType={renderMeta.domain?.physicalType}
            compactMode={compactMode}
          />
        );
      })}
      {hiddenUnconnectedColumnCount > 0 && (
        <div className="px-3 py-1 text-2xs text-muted-foreground">
          {t('erd.tableNode.hiddenColumnSummary', { count: hiddenUnconnectedColumnCount })}
        </div>
      )}
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
  const connectedColumnIds = useConnectedColumnIds(props.id);
  const node = {
    id: props.id,
    type: 'previewTable' as const,
    position: { x: props.positionAbsoluteX, y: props.positionAbsoluteY },
    data: props.data,
  };
  return (
    <PreviewTableNodeFrame node={node}>
      <PreviewTableRows node={node} connectedColumnIds={connectedColumnIds} />
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
  const connectedColumnIds = useConnectedColumnIds(props.id);
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
        connectedColumnIds={connectedColumnIds}
        compactModeOverride="off"
        ghost
      />
    </PreviewTableNodeFrame>
  );
}

/**
 * persisted table 노드가 preview canvas에 잠깐 섞일 때 사용할 read-only fallback 노드.
 *
 * preview 전용 프레임과 컬럼 렌더러를 그대로 재사용해서, 경고는 없애되 persisted 편집 동작은
 * preview canvas로 새지 않게 유지한다.
 *
 * @param props persisted table React Flow 노드 props
 * @returns preview-safe fallback 노드
 */
function PreviewPersistedTableFallbackNode(props: NodeProps<PersistedTableNode>) {
  const connectedColumnIds = useConnectedColumnIds(props.id);
  const node: DslPreviewNode = {
    id: props.id,
    type: 'previewTable',
    position: { x: props.positionAbsoluteX, y: props.positionAbsoluteY },
    data: {
      label: props.data.label,
      logicalTableName: props.data.logicalTableName,
      tableTermId: props.data.tableTermId,
      headerColor: props.data.headerColor,
      handleLayout: props.data.handleLayout,
      columns: props.data.columns,
    },
  };

  return (
    <PreviewTableNodeFrame node={node}>
      <PreviewTableRows node={node} connectedColumnIds={connectedColumnIds} />
    </PreviewTableNodeFrame>
  );
}

/** persisted/preview canvas 공통 preview node types */
export const previewNodeTypes: NodeTypes = {
  previewTable: memo(PreviewTableNode),
  previewGhostTable: memo(PreviewGhostTableNode),
};

/** preview canvas 전용 superset node types */
export const previewCanvasNodeTypes: NodeTypes = {
  table: memo(PreviewPersistedTableFallbackNode),
  ...previewNodeTypes,
};
