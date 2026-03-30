import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { Column, TableHandleLayout } from '@/types/erd';
import type { ColumnRenderMeta, WarningValidationStatus } from '@/hooks/useColumnValidation';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';
import type { TermSelectResult } from './ColumnAutocomplete';
import type { ColumnHandlePlacement } from './columnHandleLayout';
import StaticColumnRow from './StaticColumnRow';
import EditableColumnRow from './EditableColumnRow';

interface SortableColumnRowProps {
  col: Column;
  canEdit: boolean;
  children: React.ReactNode;
  t: TFunction;
}

function SortableColumnRow({ col, canEdit, children, t }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {canEdit && (
        <div
          className="nodrag absolute left-0 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover/col:opacity-100 hover:!opacity-100 transition-opacity z-10 pl-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">
            {t('erd.tableNode.aria.reorderColumn', { name: col.name })}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

interface TableNodeEditableRowsProps {
  nodeId: string;
  columns: Column[];
  canEdit: boolean;
  fkMode: boolean;
  resolvedHandleLayout: TableHandleLayout;
  renderMetaById: Map<string, ColumnRenderMeta>;
  domainPopoverColId: string | null;
  sensors: SensorDescriptor<any>[];
  isConnected: (colId: string) => boolean;
  t: TFunction;
  onDragEnd: (event: DragEndEvent) => void;
  onDomainPopoverOpenChange: (open: boolean, colId: string) => void;
  onUpdateColumn: (colId: string, updates: Partial<Column>) => void;
  onDeleteColumn: (colId: string) => void;
  onLogicalNameChange: (colId: string, value: string) => void;
  onSelectTerm: (colId: string, result: TermSelectResult) => void;
  onSelectDerived: (colId: string, resolution: LogicalNameResolution) => void;
  onRegisterNew: (colId: string, logicalName: string) => void;
  onDomainChange: (colId: string, domainId: number | null, physicalType?: string) => void;
}

export function TableNodeEditableRows({
  nodeId,
  columns,
  canEdit,
  fkMode,
  resolvedHandleLayout,
  renderMetaById,
  domainPopoverColId,
  sensors,
  isConnected,
  t,
  onDragEnd,
  onDomainPopoverOpenChange,
  onUpdateColumn,
  onDeleteColumn,
  onLogicalNameChange,
  onSelectTerm,
  onSelectDerived,
  onRegisterNew,
  onDomainChange,
}: TableNodeEditableRowsProps) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-border">
          {columns.map((column) => {
            const renderMeta = renderMetaById.get(column.id);
            if (!renderMeta) {
              return null;
            }

            return (
              <SortableColumnRow key={column.id} col={column} canEdit={canEdit} t={t}>
                <EditableColumnRow
                  col={column}
                  nodeId={nodeId}
                  canEdit={canEdit}
                  fkMode={fkMode}
                  connected={isConnected(column.id)}
                  handleLayout={resolvedHandleLayout}
                  warning={renderMeta.warning}
                  hasDuplicateLogicalName={renderMeta.hasDuplicateLogicalName}
                  normalizedLogicalName={renderMeta.normalizedLogicalName}
                  domain={renderMeta.domain}
                  domainPopoverOpen={domainPopoverColId === column.id}
                  onDomainPopoverOpenChange={(open) => onDomainPopoverOpenChange(open, column.id)}
                  onUpdateColumn={onUpdateColumn}
                  onDeleteColumn={onDeleteColumn}
                  onLogicalNameChange={onLogicalNameChange}
                  onSelectTerm={onSelectTerm}
                  onSelectDerived={onSelectDerived}
                  onRegisterNew={onRegisterNew}
                  onDomainChange={onDomainChange}
                />
              </SortableColumnRow>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface TableNodeStaticRowsProps {
  nodeId: string;
  visibleColumns: Column[];
  hiddenUnconnectedColumnCount: number;
  compactRows: boolean;
  fkMode: boolean;
  targetHandlePlacements: ColumnHandlePlacement[];
  sourceHandlePlacements: ColumnHandlePlacement[];
  renderMetaById: Map<string, ColumnRenderMeta>;
  validationWarningTextByStatus: Record<WarningValidationStatus, string>;
  isConnected: (colId: string) => boolean;
  t: TFunction;
}

export function TableNodeStaticRows({
  nodeId,
  visibleColumns,
  hiddenUnconnectedColumnCount,
  compactRows,
  fkMode,
  targetHandlePlacements,
  sourceHandlePlacements,
  renderMetaById,
  validationWarningTextByStatus,
  isConnected,
  t,
}: TableNodeStaticRowsProps) {
  return (
    <div className="divide-y divide-border">
      {visibleColumns.map((column) => {
        const renderMeta = renderMetaById.get(column.id);
        if (!renderMeta) {
          return null;
        }

        return (
          <StaticColumnRow
            key={column.id}
            col={column}
            nodeId={nodeId}
            showHandles={fkMode || isConnected(column.id)}
            targetHandlePlacements={targetHandlePlacements}
            sourceHandlePlacements={sourceHandlePlacements}
            warning={renderMeta.warning}
            validationWarningLabel={
              renderMeta.warning.status
                ? t('erd.tableNode.aria.validationWarning', { name: column.name })
                : undefined
            }
            validationWarningText={
              renderMeta.warning.status
                ? validationWarningTextByStatus[renderMeta.warning.status as WarningValidationStatus]
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
            compact={compactRows}
          />
        );
      })}
      {hiddenUnconnectedColumnCount > 0 && (
        <div className="px-3 py-1 text-2xs text-muted-foreground">
          {t('erd.tableNode.hiddenColumnSummary', { count: hiddenUnconnectedColumnCount })}
        </div>
      )}
    </div>
  );
}
