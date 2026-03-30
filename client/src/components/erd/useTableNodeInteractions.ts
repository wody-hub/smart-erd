import { useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CANVAS_HISTORY_ORIGIN } from '@/constants/canvas-history';
import { useDiagramErdCrudActions } from '@/collaboration/channel/diagram/use-diagram-erd-crud-actions';
import { useDiagramErdEdgeActions } from '@/collaboration/channel/diagram/use-diagram-erd-edge-actions';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';
import type { Domain } from '@/types/dictionary';
import type { Column, TableNode as TableNodeType } from '@/types/erd';
import type { TermSelectResult } from './ColumnAutocomplete';
import { revertDomainTypeIfNeeded } from './erdDictionaryData';

interface QuickTermTarget {
  nodeId: string;
  colId: string;
  logicalName: string;
}

interface UseTableNodeInteractionsOptions {
  nodeId: string;
  label: string;
  logicalTableName?: string;
  columns: Column[];
  resolveLogicalName: (logicalName: string) => LogicalNameResolution;
  findDomainById: (id: number) => Domain | undefined;
  canNavigateToCode: boolean;
  navigateToCode?: (request: {
    requestId: number;
    physicalName: string;
    logicalName: string | null;
  }) => void;
}

/**
 * TableNode의 편집 상호작용과 임시 UI 상태를 한 곳으로 묶는다.
 *
 * TableNode 본체는 렌더 조립에만 집중하고, CRUD/정규화/빠른용어/drag 순서 변경 같은
 * 행위 로직은 이 훅이 담당한다.
 */
export function useTableNodeInteractions({
  nodeId,
  label,
  logicalTableName,
  columns,
  resolveLogicalName,
  findDomainById,
  canNavigateToCode,
  navigateToCode,
}: UseTableNodeInteractionsOptions) {
  const crudActions = useDiagramErdCrudActions();
  const edgeActions = useDiagramErdEdgeActions();

  const [quickTermTarget, setQuickTermTarget] = useState<QuickTermTarget | null>(null);
  const [domainPopoverColId, setDomainPopoverColId] = useState<string | null>(null);
  const [tableQuickTermLogicalName, setTableQuickTermLogicalName] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const applyTableMetaUpdates = (
    updates: Partial<
      Pick<
        TableNodeType['data'],
        'label' | 'logicalTableName' | 'tableTermId' | 'headerColor' | 'handleLayout'
      >
    >,
  ) => {
    crudActions.updateTableMeta(nodeId, updates);
  };

  const applyColumnUpdates = (colId: string, updates: Partial<Column>) => {
    crudActions.updateColumn(nodeId, colId, updates);
  };

  const handleAddColumn = () => {
    crudActions.addColumn(nodeId);
  };

  const handleDeleteColumn = (colId: string) => {
    crudActions.deleteColumn(nodeId, colId);
  };

  const handleRename = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    crudActions.renameTable(nodeId, trimmed);
  };

  const handleTableLogicalNameChange = (newValue: string) => {
    const trimmed = newValue.trim();
    const resolution = resolveLogicalName(newValue);
    applyTableMetaUpdates({
      logicalTableName: trimmed || undefined,
      label: resolution.isWordCompleteMatch ? resolution.physicalName : label,
      tableTermId: resolution.isRegisteredTerm ? resolution.termId : undefined,
    });
  };

  const handleTableSelectTerm = (result: TermSelectResult) => {
    applyTableMetaUpdates({
      logicalTableName: result.logicalName,
      label: result.name,
      tableTermId: result.termId,
    });
  };

  const handleTableSelectDerived = (resolution: LogicalNameResolution) => {
    applyTableMetaUpdates({
      logicalTableName: resolution.query,
      label: resolution.physicalName,
      tableTermId: resolution.isRegisteredTerm ? resolution.termId : undefined,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const fromIndex = columns.findIndex((column) => column.id === active.id);
    const toIndex = columns.findIndex((column) => column.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      crudActions.moveColumn(nodeId, fromIndex, toIndex);
    }
  };

  const handleLogicalNameChange = (colId: string, newValue: string) => {
    const column = columns.find((item) => item.id === colId);
    const resolution = resolveLogicalName(newValue);
    const updates: Partial<Column> = {
      logicalName: newValue || undefined,
      termId: undefined,
      domainId: undefined,
    };

    if (resolution.isWordCompleteMatch) {
      updates.name = resolution.physicalName;
    }

    if (resolution.isRegisteredTerm) {
      updates.termId = resolution.termId;
      updates.domainId = resolution.domainId ?? undefined;
      if (resolution.physicalType) {
        updates.type = resolution.physicalType;
      } else {
        updates.type = revertDomainTypeIfNeeded(column, findDomainById) ?? updates.type;
      }
    } else {
      updates.type = revertDomainTypeIfNeeded(column, findDomainById) ?? updates.type;
    }

    applyColumnUpdates(colId, updates);
  };

  const handleSelectTerm = (colId: string, result: TermSelectResult) => {
    const column = columns.find((item) => item.id === colId);
    const updates: Partial<Column> = {
      logicalName: result.logicalName,
      name: result.name,
      termId: result.termId,
      domainId: result.domainId,
    };
    if (result.type) {
      updates.type = result.type;
    } else {
      updates.type = revertDomainTypeIfNeeded(column, findDomainById) ?? updates.type;
    }
    applyColumnUpdates(colId, updates);
  };

  const handleDomainChange = (colId: string, domainId: number | null, physicalType?: string) => {
    const updates: Partial<Column> = { domainId: domainId ?? undefined };
    if (domainId) {
      const resolvedType = physicalType ?? findDomainById(domainId)?.physicalType;
      if (resolvedType) {
        updates.type = resolvedType;
      }
    }
    applyColumnUpdates(colId, updates);
  };

  const handleDerivedSelect = (colId: string, resolution: LogicalNameResolution) => {
    const column = columns.find((item) => item.id === colId);
    const updates: Partial<Column> = {
      logicalName: resolution.query || undefined,
      name: resolution.physicalName,
      termId: resolution.isRegisteredTerm ? resolution.termId : undefined,
      domainId: resolution.isRegisteredTerm ? (resolution.domainId ?? undefined) : undefined,
    };
    if (resolution.isRegisteredTerm && resolution.physicalType) {
      updates.type = resolution.physicalType;
    } else {
      updates.type = revertDomainTypeIfNeeded(column, findDomainById) ?? updates.type;
    }
    applyColumnUpdates(colId, updates);
  };

  const handleQuickTermApply = (updates: Partial<Column>) => {
    if (!quickTermTarget) {
      return;
    }
    applyColumnUpdates(quickTermTarget.colId, updates);
    setQuickTermTarget(null);
  };

  const handleTableQuickTermApply = (updates: Partial<Column>) => {
    applyTableMetaUpdates({
      logicalTableName: updates.logicalName || undefined,
      label: updates.name || label,
      tableTermId: updates.termId,
    });
    setTableQuickTermLogicalName(null);
  };

  const handleNavigateToCode = () => {
    if (!canNavigateToCode || !navigateToCode) {
      return;
    }
    navigateToCode({
      requestId: Date.now(),
      physicalName: label,
      logicalName: logicalTableName?.trim() || null,
    });
  };

  const handleHeaderColorChange = (color: TableNodeType['data']['headerColor']) => {
    applyTableMetaUpdates({ headerColor: color });
  };

  const handleHeaderHandleLayoutChange = (layout: TableNodeType['data']['handleLayout']) => {
    applyTableMetaUpdates({ handleLayout: layout });
    requestAnimationFrame(() => {
      edgeActions.normalizeEdgeHandles([nodeId], 'table-meta', {
        origin: CANVAS_HISTORY_ORIGIN.USER_TABLE,
      });
    });
  };

  return {
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
  };
}
