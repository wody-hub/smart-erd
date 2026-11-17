import { useMemo } from 'react';
import type { DdlParseResult } from '@/lib/ddl-parser';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { Column, TableHeaderColor, TableNodeData } from '@/types/erd';
import {
  resolveDiagramAppliedStatus,
  resolveDiagramDocumentStatus,
} from '@/collaboration/channel/diagram/diagram-session-action-utils';
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
  const importDdlFallback = useCanvasStore((s) => s.importDdl);
  const notifyRejected = useDiagramRejectedCommandToast();

  return useMemo(
    () => ({
      addTable: (name?: string) => {
        return resolveDiagramDocumentStatus(erdDocumentActions.addTable(name), notifyRejected);
      },
      deleteTable: (tableId: string) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.deleteTable(tableId),
          notifyRejected,
        );
      },
      moveTable: (tableId: string, positionX: number, positionY: number) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.moveTable(tableId, positionX, positionY),
          notifyRejected,
        );
      },
      renameTable: (tableId: string, label: string) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.renameTable(tableId, label),
          notifyRejected,
        );
      },
      updateTableMeta: (tableId: string, updates: TableMetaUpdates) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateTableMeta(tableId, updates),
          notifyRejected,
        );
      },
      addColumn: (tableId: string) => {
        return resolveDiagramDocumentStatus(erdDocumentActions.addColumn(tableId), notifyRejected);
      },
      deleteColumn: (tableId: string, colId: string) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.deleteColumn(tableId, colId),
          notifyRejected,
        );
      },
      moveColumn: (tableId: string, fromIndex: number, toIndex: number) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.moveColumn(tableId, fromIndex, toIndex),
          notifyRejected,
        );
      },
      updateColumn: (tableId: string, colId: string, updates: Partial<Column>) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateColumn(tableId, colId, updates),
          notifyRejected,
        );
      },
      addGroup: (label?: string) => {
        return resolveDiagramDocumentStatus(erdDocumentActions.addGroup(label), notifyRejected);
      },
      deleteGroup: (groupId: string) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.deleteGroup(groupId),
          notifyRejected,
        );
      },
      renameGroup: (groupId: string, label: string) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.renameGroup(groupId, label),
          notifyRejected,
        );
      },
      updateGroupColor: (groupId: string, color: TableHeaderColor | 'default') => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateGroupColor(groupId, color),
          notifyRejected,
        );
      },
      updateGroupTables: (groupId: string, toAdd: string[], toRemove: string[]) => {
        return resolveDiagramDocumentStatus(
          erdDocumentActions.updateGroupTables(groupId, toAdd, toRemove),
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
    [erdDocumentActions, importDdlFallback, notifyRejected],
  );
}
