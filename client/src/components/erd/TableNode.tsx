import { memo, useEffect, useMemo } from 'react';
import { useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TableNode as TableNodeType } from '@/types/erd';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import { useErdDictionary } from './ErdDictionaryContext';
import { useErdPermission } from './ErdPermissionContext';
import { useErdFkMode } from './ErdFkModeContext';
import { useRemoteEditLocksContext } from './RemoteEditLocksContext';
import type { WarningValidationStatus } from '@/hooks/useColumnValidation';
import { cn } from '@/lib/utils';
import QuickTermDialog from './QuickTermDialog';
import TableNodeHeader from './TableNodeHeader';
import { useDiagramCodeNavigation } from './DiagramCodeNavigationContext';
import { getColumnHandlePlacements } from './columnHandleLayout';
import { useConnectedColumnDirections, useConnectedColumnIds } from './ConnectedColumnIdsContext';
import { useCompactTableRenderingMode } from './CompactTableRenderingContext';
import { useTableColumnRenderModel } from './useTableColumnRenderModel';
import { useTableNodeInteractions } from './useTableNodeInteractions';
import { TableNodeEditableRows, TableNodeStaticRows } from './TableNodeRows';
import { useCompactTableRowExpansion } from './useCompactTableRowExpansion';

const TABLE_NODE_INTERNALS_BATCH_SIZE = 6;

const pendingNodeInternalsUpdates = new Map<string, (id: string) => void>();
let nodeInternalsFlushHandle: number | null = null;

function flushPendingNodeInternalsUpdates() {
  nodeInternalsFlushHandle = null;

  const queued = Array.from(pendingNodeInternalsUpdates.entries()).slice(
    0,
    TABLE_NODE_INTERNALS_BATCH_SIZE,
  );

  for (const [nodeId, updateInternals] of queued) {
    pendingNodeInternalsUpdates.delete(nodeId);
    updateInternals(nodeId);
  }

  if (pendingNodeInternalsUpdates.size > 0) {
    nodeInternalsFlushHandle = window.requestAnimationFrame(flushPendingNodeInternalsUpdates);
  }
}

function scheduleNodeInternalsUpdate(nodeId: string, updateInternals: (id: string) => void) {
  pendingNodeInternalsUpdates.set(nodeId, updateInternals);

  if (nodeInternalsFlushHandle == null) {
    nodeInternalsFlushHandle = window.requestAnimationFrame(flushPendingNodeInternalsUpdates);
  }
}

function cancelScheduledNodeInternalsUpdate(nodeId: string) {
  pendingNodeInternalsUpdates.delete(nodeId);

  if (pendingNodeInternalsUpdates.size === 0 && nodeInternalsFlushHandle != null) {
    window.cancelAnimationFrame(nodeInternalsFlushHandle);
    nodeInternalsFlushHandle = null;
  }
}

/**
 * ERD 테이블 커스텀 노드 컴포넌트.
 *
 * 테이블 헤더(논리명 + 물리명)와 컬럼 목록을 렌더링한다.
 * 헤더는 논리명이 있으면 2줄(논리명 + 물리명), 없으면 1줄(물리명만) 레이아웃.
 * 각 컬럼에 PK/FK 뱃지와 좌우 Handle(source/target)을 배치하여
 * 컬럼 레벨의 관계 연결을 지원한다.
 * @dnd-kit으로 컬럼 드래그 앤 드롭 순서 변경을 지원한다.
 *
 * @param props.id   React Flow 노드 ID
 * @param props.data 테이블 데이터 (label, columns, logicalTableName, headerColor)
 * @param props.selected 선택 상태
 */
function TableNode({ id, data, selected = false }: NodeProps<TableNodeType>) {
  const { t } = useTranslation();
  const { label, columns, logicalTableName, tableTermId, headerColor, handleLayout } = data;
  const updateNodeInternals = useUpdateNodeInternals();
  const isHighlighted = useCanvasStore((s) => s.highlightedNodeIds.includes(id));

  const { findTermById, findDomainById, resolveLogicalName } = useErdDictionary();
  const { canNavigateToCode, navigateToCode } = useDiagramCodeNavigation();
  const { canEdit: permissionCanEdit } = useErdPermission();
  const { locksByNodeId } = useRemoteEditLocksContext();
  const lockInfo = locksByNodeId.get(id);
  const canEdit = permissionCanEdit && !lockInfo;
  /** 이 노드가 현재 편집 모드인지 여부 (파생 boolean으로 전환 시 최대 2개 노드만 리렌더링) */
  const isEditingState = useCanvasStore((s) => s.activeEditNodeId === id);
  /** 편집 권한이 있고, 이 노드가 편집 모드로 활성화된 상태 */
  const isEditing = canEdit && isEditingState;
  const fkMode = useErdFkMode();
  const resolvedHandleLayout = handleLayout ?? 'split';
  const targetHandlePlacements = useMemo(
    () => getColumnHandlePlacements(resolvedHandleLayout, 'target'),
    [resolvedHandleLayout],
  );
  const sourceHandlePlacements = useMemo(
    () => getColumnHandlePlacements(resolvedHandleLayout, 'source'),
    [resolvedHandleLayout],
  );

  /** 관계선이 연결된 컬럼 ID 셋 */
  const connectedColumnIds = useConnectedColumnIds(id);
  const connectedColumnDirections = useConnectedColumnDirections(id);
  const compactTableRenderingMode = useCompactTableRenderingMode();

  /** 해당 컬럼이 엣지에 연결되어 있는지 확인한다. */
  const isConnected = (colId: string) => connectedColumnIds.has(colId);
  const getConnectedDirections = (colId: string) =>
    connectedColumnDirections.get(colId) ?? { source: false, target: false };
  const {
    compactMode: staticRowCompactMode,
    canExpandHiddenColumns,
    expandHiddenColumns,
  } = useCompactTableRowExpansion(compactTableRenderingMode, {
    selected,
    isEditing,
    fkMode,
  });
  const {
    renderMetaById: columnRenderMetaById,
    duplicateLogicalNameColumnCount,
    validationWarningTextByStatus,
    visibleColumns: visibleStaticColumns,
    hiddenUnconnectedColumnCount,
  } = useTableColumnRenderModel({
    columns,
    t,
    resolveLogicalName,
    findTermById,
    findDomainById,
  });
  const {
    sensors,
    quickTermTarget,
    domainPopoverColId,
    tableQuickTermLogicalName,
    setDomainPopoverColId,
    setTableQuickTermLogicalName,
    setQuickTermTarget,
    applyColumnUpdates,
    handleAddColumn,
    handleDeleteColumn,
    handleRename,
    handleTableLogicalNameChange,
    handleTableSelectTerm,
    handleTableSelectDerived,
    handleDragEnd,
    handleLogicalNameChange,
    handleSelectTerm,
    handleDomainChange,
    handleDerivedSelect,
    handleQuickTermApply,
    handleTableQuickTermApply,
    handleNavigateToCode,
    handleHeaderColorChange,
    handleHeaderHandleLayoutChange,
  } = useTableNodeInteractions({
    nodeId: id,
    label,
    logicalTableName,
    columns,
    resolveLogicalName,
    findDomainById,
    canNavigateToCode,
    navigateToCode,
  });

  useEffect(() => {
    if (!fkMode && connectedColumnIds.size === 0) {
      cancelScheduledNodeInternalsUpdate(id);
      return;
    }

    scheduleNodeInternalsUpdate(id, updateNodeInternals);
    return () => {
      cancelScheduledNodeInternalsUpdate(id);
    };
  }, [columns.length, connectedColumnIds, fkMode, handleLayout, id, updateNodeInternals]);

  return (
    <div
      data-table-node-kind="persisted"
      data-table-name={label}
      data-table-logical-name={logicalTableName ?? ''}
      className={cn(
        'surface-data w-max min-w-[420px] rounded shadow-operational',
        isHighlighted && 'ring-2 ring-primary shadow-editorial',
      )}
    >
      {/* Table header */}
      <TableNodeHeader
        label={label}
        logicalTableName={logicalTableName}
        tableTermId={tableTermId}
        headerColor={headerColor}
        handleLayout={handleLayout}
        isEditing={isEditing}
        duplicateLogicalNameColumnCount={duplicateLogicalNameColumnCount}
        lockInfo={lockInfo}
        onLogicalNameChange={handleTableLogicalNameChange}
        onSelectTerm={handleTableSelectTerm}
        onSelectDerived={handleTableSelectDerived}
        onRegisterNew={setTableQuickTermLogicalName}
        onNavigateToCode={canNavigateToCode ? handleNavigateToCode : undefined}
        onRename={handleRename}
        onColorChange={handleHeaderColorChange}
        onHandleLayoutChange={handleHeaderHandleLayoutChange}
      />

      {/* Columns — 편집 모드: DnD 래핑, 정적 모드: StaticColumnRow */}
      {isEditing ? (
        <TableNodeEditableRows
          nodeId={id}
          columns={columns}
          canEdit={canEdit}
          fkMode={fkMode}
          resolvedHandleLayout={resolvedHandleLayout}
          renderMetaById={columnRenderMetaById}
          domainPopoverColId={domainPopoverColId}
          sensors={sensors}
          isConnected={isConnected}
          t={t}
          onDragEnd={handleDragEnd}
          onDomainPopoverOpenChange={(open, colId) => setDomainPopoverColId(open ? colId : null)}
          onUpdateColumn={applyColumnUpdates}
          onDeleteColumn={handleDeleteColumn}
          onLogicalNameChange={handleLogicalNameChange}
          onSelectTerm={handleSelectTerm}
          onSelectDerived={handleDerivedSelect}
          onRegisterNew={(colId, logicalName) =>
            setQuickTermTarget({
              nodeId: id,
              colId,
              logicalName,
            })
          }
          onDomainChange={handleDomainChange}
        />
      ) : (
        <TableNodeStaticRows
          nodeId={id}
          visibleColumns={visibleStaticColumns}
          hiddenUnconnectedColumnCount={hiddenUnconnectedColumnCount}
          compactMode={staticRowCompactMode}
          fkMode={fkMode}
          targetHandlePlacements={targetHandlePlacements}
          sourceHandlePlacements={sourceHandlePlacements}
          renderMetaById={columnRenderMetaById}
          validationWarningTextByStatus={
            validationWarningTextByStatus as Record<WarningValidationStatus, string>
          }
          getConnectedDirections={getConnectedDirections}
          onExpandHiddenColumns={
            canExpandHiddenColumns && hiddenUnconnectedColumnCount > 0
              ? expandHiddenColumns
              : undefined
          }
          t={t}
        />
      )}

      {/* Add column button */}
      {isEditing && (
        <div className="border-t border-border">
          <button
            className="nodrag flex w-full items-center justify-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={handleAddColumn}
          >
            <Plus className="h-3 w-3" />
            {t('erd.tableNode.addColumn')}
          </button>
        </div>
      )}
      {quickTermTarget && (
        <QuickTermDialog
          open
          onOpenChange={(open) => {
            if (!open) setQuickTermTarget(null);
          }}
          initialLogicalName={quickTermTarget.logicalName}
          onApply={handleQuickTermApply}
        />
      )}
      {tableQuickTermLogicalName && (
        <QuickTermDialog
          open
          onOpenChange={(open) => {
            if (!open) setTableQuickTermLogicalName(null);
          }}
          initialLogicalName={tableQuickTermLogicalName}
          onApply={handleTableQuickTermApply}
        />
      )}
    </div>
  );
}

export default memo(TableNode);
