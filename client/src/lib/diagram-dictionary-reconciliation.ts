import type { Node } from '@xyflow/react';
import type { Column, TableNodeData } from '../types/erd.js';
import type { LogicalNameResolution } from './logical-name-resolution.js';
import type { Domain, Term } from '../types/dictionary.js';

export const DEFAULT_COLUMN_TYPE = 'VARCHAR(255)';

export interface DiagramDictionaryRuntime {
  findTermById: (id: number) => Term | undefined;
  findDomainById: (id: number) => Domain | undefined;
  resolveLogicalName: (logicalName: string) => LogicalNameResolution;
}

export interface DiagramDictionaryReconciliationPlan {
  tableMetaUpdates: Array<{
    nodeId: string;
    updates: Partial<Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId'>>;
  }>;
  columnUpdates: Array<{
    nodeId: string;
    colId: string;
    updates: Partial<Column>;
  }>;
}

function hasOwnKeys(value: object): boolean {
  return Object.keys(value).length > 0;
}

function setIfChanged<T extends object>(updates: Partial<T>, key: keyof T, current: unknown, next: unknown) {
  if (current !== next) {
    (updates as Record<keyof T, unknown>)[key] = next;
  }
}

function reconcileTableMeta(
  data: TableNodeData,
  runtime: DiagramDictionaryRuntime,
): Partial<Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId'>> {
  const updates: Partial<Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId'>> = {};
  const logicalTableName = data.logicalTableName?.trim() ?? '';

  if (data.tableTermId != null) {
    const linkedTerm = runtime.findTermById(data.tableTermId);
    if (linkedTerm) {
      setIfChanged(updates, 'logicalTableName', data.logicalTableName, linkedTerm.logicalName);
      setIfChanged(updates, 'label', data.label, linkedTerm.physicalName);
      return updates;
    }
    setIfChanged(updates, 'tableTermId', data.tableTermId, undefined);
  }

  if (!logicalTableName) {
    return updates;
  }

  const resolution = runtime.resolveLogicalName(logicalTableName);
  if (resolution.isRegisteredTerm && resolution.term) {
    setIfChanged(updates, 'logicalTableName', data.logicalTableName, resolution.term.logicalName);
    setIfChanged(updates, 'label', data.label, resolution.term.physicalName);
    setIfChanged(updates, 'tableTermId', data.tableTermId, resolution.term.id);
    return updates;
  }

  if (resolution.isWordCompleteMatch) {
    setIfChanged(updates, 'label', data.label, resolution.physicalName);
  }

  return updates;
}

function clearDerivedTypeIfNeeded(
  updates: Partial<Column>,
  column: Column,
  previousDomain: Domain | undefined,
): void {
  if (previousDomain && column.type === previousDomain.physicalType) {
    setIfChanged(updates, 'type', column.type, DEFAULT_COLUMN_TYPE);
  }
}

function reconcileColumn(
  column: Column,
  runtime: DiagramDictionaryRuntime,
): Partial<Column> {
  const updates: Partial<Column> = {};
  const previousDomain = column.domainId != null ? runtime.findDomainById(column.domainId) : undefined;
  const logicalName = column.logicalName?.trim() ?? '';

  if (column.termId != null) {
    const linkedTerm = runtime.findTermById(column.termId);
    if (linkedTerm) {
      setIfChanged(updates, 'logicalName', column.logicalName, linkedTerm.logicalName);
      setIfChanged(updates, 'name', column.name, linkedTerm.physicalName);

      const nextDomainId = linkedTerm.domainId ?? undefined;
      setIfChanged(updates, 'domainId', column.domainId, nextDomainId);

      if (linkedTerm.domainId != null) {
        const linkedDomain = runtime.findDomainById(linkedTerm.domainId);
        if (linkedDomain) {
          setIfChanged(updates, 'type', column.type, linkedDomain.physicalType);
        } else {
          setIfChanged(updates, 'domainId', column.domainId, undefined);
          clearDerivedTypeIfNeeded(updates, column, previousDomain);
        }
      } else {
        setIfChanged(updates, 'domainId', column.domainId, undefined);
        clearDerivedTypeIfNeeded(updates, column, previousDomain);
      }

      return updates;
    }

    setIfChanged(updates, 'termId', column.termId, undefined);
    setIfChanged(updates, 'domainId', column.domainId, undefined);
    clearDerivedTypeIfNeeded(updates, column, previousDomain);
  } else if (column.domainId != null) {
    const explicitDomain = runtime.findDomainById(column.domainId);
    if (explicitDomain) {
      setIfChanged(updates, 'type', column.type, explicitDomain.physicalType);
    } else {
      setIfChanged(updates, 'domainId', column.domainId, undefined);
      clearDerivedTypeIfNeeded(updates, column, previousDomain);
    }
  }

  if (!logicalName) {
    return updates;
  }

  const resolution = runtime.resolveLogicalName(logicalName);
  if (resolution.isRegisteredTerm && resolution.term) {
    setIfChanged(updates, 'logicalName', column.logicalName, resolution.term.logicalName);
    setIfChanged(updates, 'name', column.name, resolution.term.physicalName);
    setIfChanged(updates, 'termId', column.termId, resolution.term.id);

    const nextDomainId = resolution.term.domainId ?? undefined;
    setIfChanged(updates, 'domainId', column.domainId, nextDomainId);

    if (resolution.physicalType) {
      setIfChanged(updates, 'type', column.type, resolution.physicalType);
    } else {
      clearDerivedTypeIfNeeded(updates, column, previousDomain);
    }

    return updates;
  }

  if (resolution.isWordCompleteMatch) {
    setIfChanged(updates, 'name', column.name, resolution.physicalName);
  }

  return updates;
}

export function buildDiagramDictionaryReconciliationPlan(
  nodes: Array<Node<TableNodeData>>,
  runtime: DiagramDictionaryRuntime,
): DiagramDictionaryReconciliationPlan {
  const tableMetaUpdates: DiagramDictionaryReconciliationPlan['tableMetaUpdates'] = [];
  const columnUpdates: DiagramDictionaryReconciliationPlan['columnUpdates'] = [];

  for (const node of nodes) {
    const tableUpdates = reconcileTableMeta(node.data, runtime);
    if (hasOwnKeys(tableUpdates)) {
      tableMetaUpdates.push({ nodeId: node.id, updates: tableUpdates });
    }

    for (const column of node.data.columns) {
      const updates = reconcileColumn(column, runtime);
      if (hasOwnKeys(updates)) {
        columnUpdates.push({ nodeId: node.id, colId: column.id, updates });
      }
    }
  }

  return { tableMetaUpdates, columnUpdates };
}
