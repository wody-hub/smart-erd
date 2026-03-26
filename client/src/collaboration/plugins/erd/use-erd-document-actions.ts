import { useMemo } from 'react';
import type { DdlParseResult } from '@/lib/ddl-parser';
import type { DiagramDictionaryReconciliationPlan } from '@/lib/diagram-dictionary-reconciliation';
import type { ApplyDiffResult } from '@/lib/erd-diff-apply';
import type { DiffPlan } from '@/lib/erd-diff-plan';
import type { EdgeRoutingType, RelationType, Waypoint } from '@/types/erd';
import type { EdgeHandleSelectionValue } from '@/lib/edge-handles';
import type { MutationMeta } from '@/collaboration/core/contracts/document-read-executor';
import type {
  DocumentCommandDispatchResult,
  DocumentCommandDispatchStatus,
} from '@/collaboration/core/session/document-mutation-session';
import { useDocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import {
  isErdCanvasInputAdapter,
  type EdgeHandleNormalizationReason,
  type ErdCanvasInputAdapter,
} from './erd-document-plugin';
import type { Column, TableHandleLayout, TableHeaderColor, TableNodeData } from '@/types/erd';

type TableMetaUpdates = Partial<
  Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId' | 'headerColor' | 'handleLayout'>
>;

export interface ErdDocumentActions {
  available: boolean;
  addTable: (name?: string, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  deleteTable: (tableId: string, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  connectEdge: (
    sourceTableId: string,
    targetTableId: string,
    sourceHandle: string,
    targetHandle: string,
    relationType: RelationType,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  addFkRelation: (
    parentTableId: string,
    childTableId: string,
    relationType: RelationType,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  deleteEdge: (
    edgeId: string,
    removeFkColumn?: boolean,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateEdgeRoutingType: (
    edgeId: string,
    routingType: EdgeRoutingType,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateEdgeHandleSelection: (
    edgeId: string,
    selection: EdgeHandleSelectionValue,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateEdgeWaypoints: (
    edgeId: string,
    waypoints: Waypoint[],
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  resetEdgeWaypoints: (edgeId: string, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  normalizeEdgeHandles: (
    nodeIds?: string[],
    reason?: EdgeHandleNormalizationReason,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  moveTable: (
    tableId: string,
    positionX: number,
    positionY: number,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  renameTable: (
    tableId: string,
    label: string,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  addColumn: (tableId: string, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  deleteColumn: (
    tableId: string,
    colId: string,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  moveColumn: (
    tableId: string,
    fromIndex: number,
    toIndex: number,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  addGroup: (label?: string, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  deleteGroup: (groupId: string, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  renameGroup: (
    groupId: string,
    label: string,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateGroupColor: (
    groupId: string,
    color: TableHeaderColor | 'default',
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateGroupTables: (
    groupId: string,
    toAdd: string[],
    toRemove: string[],
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  importDdl: (result: DdlParseResult, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  replaceFromDdl: (result: DdlParseResult, meta?: MutationMeta) => DocumentCommandDispatchStatus;
  applyDiffPlan: (
    plan: DiffPlan,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchResult<ApplyDiffResult>;
  reconcileDictionary: (
    plan: DiagramDictionaryReconciliationPlan,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateTableMeta: (
    tableId: string,
    updates: TableMetaUpdates,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
  updateColumn: (
    tableId: string,
    colId: string,
    updates: Partial<Column>,
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus;
}

const UNAVAILABLE_ACTIONS: ErdDocumentActions = {
  available: false,
  addTable: () => 'unavailable',
  deleteTable: () => 'unavailable',
  connectEdge: () => 'unavailable',
  addFkRelation: () => 'unavailable',
  deleteEdge: () => 'unavailable',
  updateEdgeRoutingType: () => 'unavailable',
  updateEdgeHandleSelection: () => 'unavailable',
  updateEdgeWaypoints: () => 'unavailable',
  resetEdgeWaypoints: () => 'unavailable',
  normalizeEdgeHandles: () => 'unavailable',
  moveTable: () => 'unavailable',
  renameTable: () => 'unavailable',
  addColumn: () => 'unavailable',
  deleteColumn: () => 'unavailable',
  moveColumn: () => 'unavailable',
  addGroup: () => 'unavailable',
  deleteGroup: () => 'unavailable',
  renameGroup: () => 'unavailable',
  updateGroupColor: () => 'unavailable',
  updateGroupTables: () => 'unavailable',
  importDdl: () => 'unavailable',
  replaceFromDdl: () => 'unavailable',
  applyDiffPlan: () => ({ status: 'unavailable' }),
  reconcileDictionary: () => 'unavailable',
  updateTableMeta: () => 'unavailable',
  updateColumn: () => 'unavailable',
};

export function useErdDocumentActions(): ErdDocumentActions {
  const documentMutationSession = useDocumentMutationSession();

  return useMemo(() => {
    if (!documentMutationSession?.enabled) {
      return UNAVAILABLE_ACTIONS;
    }
    const canvasAdapter = documentMutationSession.inputAdapters?.canvas;
    if (!isErdCanvasInputAdapter(canvasAdapter)) {
      return UNAVAILABLE_ACTIONS;
    }

    return createErdDocumentActions(
      documentMutationSession.emitCommand,
      documentMutationSession.emitCommandWithResult,
      canvasAdapter,
    );
  }, [documentMutationSession]);
}

function createErdDocumentActions(
  emitCommand: (
    command: { key: string; payload?: Record<string, unknown> },
    meta?: MutationMeta,
  ) => DocumentCommandDispatchStatus,
  emitCommandWithResult: <T = unknown>(
    command: { key: string; payload?: Record<string, unknown> },
    meta?: MutationMeta,
  ) => DocumentCommandDispatchResult<T>,
  canvasAdapter: ErdCanvasInputAdapter,
): ErdDocumentActions {
  return {
    available: true,
    addTable: (name, meta) => emitCommand(canvasAdapter.addTable(name), meta),
    deleteTable: (tableId, meta) => emitCommand(canvasAdapter.deleteTable(tableId), meta),
    connectEdge: (sourceTableId, targetTableId, sourceHandle, targetHandle, relationType, meta) =>
      emitCommand(
        canvasAdapter.connectEdge(
          sourceTableId,
          targetTableId,
          sourceHandle,
          targetHandle,
          relationType,
        ),
        meta,
      ),
    addFkRelation: (parentTableId, childTableId, relationType, meta) =>
      emitCommand(canvasAdapter.addFkRelation(parentTableId, childTableId, relationType), meta),
    deleteEdge: (edgeId, removeFkColumn, meta) =>
      emitCommand(canvasAdapter.deleteEdge(edgeId, removeFkColumn), meta),
    updateEdgeRoutingType: (edgeId, routingType, meta) =>
      emitCommand(canvasAdapter.updateEdgeRoutingType(edgeId, routingType), meta),
    updateEdgeHandleSelection: (edgeId, selection, meta) =>
      emitCommand(canvasAdapter.updateEdgeHandleSelection(edgeId, selection), meta),
    updateEdgeWaypoints: (edgeId, waypoints, meta) =>
      emitCommand(canvasAdapter.updateEdgeWaypoints(edgeId, waypoints), meta),
    resetEdgeWaypoints: (edgeId, meta) =>
      emitCommand(canvasAdapter.resetEdgeWaypoints(edgeId), meta),
    normalizeEdgeHandles: (nodeIds, reason, meta) =>
      emitCommand(canvasAdapter.normalizeEdgeHandles(nodeIds, reason), meta),
    moveTable: (tableId, positionX, positionY, meta) =>
      emitCommand(canvasAdapter.moveTable(tableId, positionX, positionY), meta),
    renameTable: (tableId, label, meta) =>
      emitCommand(canvasAdapter.renameTable(tableId, label), meta),
    addColumn: (tableId, meta) => emitCommand(canvasAdapter.addColumn(tableId), meta),
    deleteColumn: (tableId, colId, meta) =>
      emitCommand(canvasAdapter.deleteColumn(tableId, colId), meta),
    moveColumn: (tableId, fromIndex, toIndex, meta) =>
      emitCommand(canvasAdapter.moveColumn(tableId, fromIndex, toIndex), meta),
    addGroup: (label, meta) => emitCommand(canvasAdapter.addGroup(label), meta),
    deleteGroup: (groupId, meta) => emitCommand(canvasAdapter.deleteGroup(groupId), meta),
    renameGroup: (groupId, label, meta) =>
      emitCommand(canvasAdapter.renameGroup(groupId, label), meta),
    updateGroupColor: (groupId, color, meta) =>
      emitCommand(canvasAdapter.updateGroupColor(groupId, color), meta),
    updateGroupTables: (groupId, toAdd, toRemove, meta) =>
      emitCommand(canvasAdapter.updateGroupTables(groupId, toAdd, toRemove), meta),
    importDdl: (result, meta) => emitCommand(canvasAdapter.importDdl(result), meta),
    replaceFromDdl: (result, meta) => emitCommand(canvasAdapter.replaceFromDdl(result), meta),
    applyDiffPlan: (plan, meta) =>
      emitCommandWithResult<ApplyDiffResult>(canvasAdapter.applyDiffPlan(plan), meta),
    reconcileDictionary: (plan, meta) => emitCommand(canvasAdapter.reconcileDictionary(plan), meta),
    updateTableMeta: (tableId, updates, meta) =>
      emitCommand(canvasAdapter.updateTableMeta(tableId, updates), meta),
    updateColumn: (tableId, colId, updates, meta) =>
      emitCommand(canvasAdapter.updateColumn(tableId, colId, updates), meta),
  };
}

export type { TableMetaUpdates, TableHeaderColor, TableHandleLayout };
