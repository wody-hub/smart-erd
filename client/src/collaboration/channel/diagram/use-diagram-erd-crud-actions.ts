import { useMemo } from 'react';
import type { DdlParseResult } from '@/lib/ddl-parser';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { Column, TableHeaderColor, TableNodeData } from '@/types/erd';
import { resolveDiagramAppliedStatus } from '@/collaboration/channel/diagram/diagram-session-action-utils';
import { useDiagramRejectedCommandToast } from '@/collaboration/channel/diagram/use-diagram-command-feedback';

type TableMetaUpdates = Partial<
  Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId' | 'headerColor' | 'handleLayout'>
>;

type AppliedStatus = 'applied' | 'rejected';

export interface DiagramErdCrudActions {
  addTable: (name?: string) => AppliedStatus;
  deleteTable: (tableId: string) => AppliedStatus;
  moveTable: (tableId: string, positionX: number, positionY: number) => AppliedStatus;
  renameTable: (tableId: string, label: string) => AppliedStatus;
  updateTableMeta: (tableId: string, updates: TableMetaUpdates) => AppliedStatus;
  addColumn: (tableId: string) => AppliedStatus;
  deleteColumn: (tableId: string, colId: string) => AppliedStatus;
  moveColumn: (tableId: string, fromIndex: number, toIndex: number) => AppliedStatus;
  updateColumn: (tableId: string, colId: string, updates: Partial<Column>) => AppliedStatus;
  addGroup: (label?: string) => AppliedStatus;
  deleteGroup: (groupId: string) => AppliedStatus;
  renameGroup: (groupId: string, label: string) => AppliedStatus;
  updateGroupColor: (groupId: string, color: TableHeaderColor | 'default') => AppliedStatus;
  updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => AppliedStatus;
  importDdl: (result: DdlParseResult) => AppliedStatus;
}

export function useDiagramErdCrudActions(): DiagramErdCrudActions {
  const erdDocumentActions = useErdDocumentActions();
  const addTableFallback = useCanvasStore((s) => s.addTable);
  const deleteTableFallback = useCanvasStore((s) => s.deleteTable);
  const finalizeNodeDragFallback = useCanvasStore((s) => s.finalizeNodeDrag);
  const renameTableFallback = useCanvasStore((s) => s.renameTable);
  const updateTableMetaFallback = useCanvasStore((s) => s.updateTableMeta);
  const addColumnFallback = useCanvasStore((s) => s.addColumn);
  const deleteColumnFallback = useCanvasStore((s) => s.deleteColumn);
  const moveColumnFallback = useCanvasStore((s) => s.moveColumn);
  const updateColumnFallback = useCanvasStore((s) => s.updateColumn);
  const addGroupFallback = useCanvasStore((s) => s.addGroup);
  const deleteGroupFallback = useCanvasStore((s) => s.deleteGroup);
  const renameGroupFallback = useCanvasStore((s) => s.renameGroup);
  const updateGroupColorFallback = useCanvasStore((s) => s.updateGroupColor);
  const updateGroupTablesFallback = useCanvasStore((s) => s.updateGroupTables);
  const importDdlFallback = useCanvasStore((s) => s.importDdl);
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      addTable: (name?: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.addTable(name),
          () => addTableFallback(name),
          notifyRejected,
        );
      },
      deleteTable: (tableId: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.deleteTable(tableId),
          () => deleteTableFallback(tableId),
          notifyRejected,
        );
      },
      moveTable: (tableId: string, positionX: number, positionY: number) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.moveTable(tableId, positionX, positionY),
          () =>
            finalizeNodeDragFallback([
              {
                nodeId: tableId,
                position: { x: positionX, y: positionY },
              },
            ]),
          notifyRejected,
        );
      },
      renameTable: (tableId: string, label: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.renameTable(tableId, label),
          () => renameTableFallback(tableId, label),
          notifyRejected,
        );
      },
      updateTableMeta: (tableId: string, updates: TableMetaUpdates) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateTableMeta(tableId, updates),
          () => updateTableMetaFallback(tableId, updates),
          notifyRejected,
        );
      },
      addColumn: (tableId: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.addColumn(tableId),
          () => addColumnFallback(tableId),
          notifyRejected,
        );
      },
      deleteColumn: (tableId: string, colId: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.deleteColumn(tableId, colId),
          () => deleteColumnFallback(tableId, colId),
          notifyRejected,
        );
      },
      moveColumn: (tableId: string, fromIndex: number, toIndex: number) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.moveColumn(tableId, fromIndex, toIndex),
          () => moveColumnFallback(tableId, fromIndex, toIndex),
          notifyRejected,
        );
      },
      updateColumn: (tableId: string, colId: string, updates: Partial<Column>) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateColumn(tableId, colId, updates),
          () => updateColumnFallback(tableId, colId, updates),
          notifyRejected,
        );
      },
      addGroup: (label?: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.addGroup(label),
          () => addGroupFallback(label),
          notifyRejected,
        );
      },
      deleteGroup: (groupId: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.deleteGroup(groupId),
          () => deleteGroupFallback(groupId),
          notifyRejected,
        );
      },
      renameGroup: (groupId: string, label: string) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.renameGroup(groupId, label),
          () => renameGroupFallback(groupId, label),
          notifyRejected,
        );
      },
      updateGroupColor: (groupId: string, color: TableHeaderColor | 'default') => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateGroupColor(groupId, color),
          () => updateGroupColorFallback(groupId, color),
          notifyRejected,
        );
      },
      updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.updateGroupTables(groupId, toAdd, toRemove),
          () => updateGroupTablesFallback(groupId, toAdd, toRemove),
          notifyRejected,
        );
      },
      importDdl: (result: DdlParseResult) => {
        return resolveDiagramAppliedStatus(
          erdDocumentActions.importDdl(result),
          () => importDdlFallback(result),
          notifyRejected,
        );
      },
    }),
    [
      addColumnFallback,
      addGroupFallback,
      addTableFallback,
      deleteColumnFallback,
      deleteGroupFallback,
      deleteTableFallback,
      erdDocumentActions,
      finalizeNodeDragFallback,
      importDdlFallback,
      moveColumnFallback,
      notifyRejected,
      renameGroupFallback,
      renameTableFallback,
      updateColumnFallback,
      updateGroupColorFallback,
      updateGroupTablesFallback,
      updateTableMetaFallback,
    ],
  );
}
