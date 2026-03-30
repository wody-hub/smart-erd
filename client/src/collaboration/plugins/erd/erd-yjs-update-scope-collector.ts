import * as Y from 'yjs';
import type { ScopeRef } from '@/collaboration/core/contracts/document-read-executor';
import type { SharedDocumentEngineUpdate } from '@/collaboration/core/contracts/shared-document-engine';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { getEdgesMap, getGroupsMap, getTablesMap } from '@/collaboration/yjsBridge';
import { buildErdColumnEntityId } from './erd-column-entity-id';

type AnyYType = Y.AbstractType<any>;

export function collectErdAffectedScopes(
  engine: YjsSharedDocumentEngine,
  update: SharedDocumentEngineUpdate,
): ScopeRef[] {
  const transaction = update.changeSet;
  if (!(transaction instanceof Y.Transaction)) {
    return [];
  }

  return collectErdAffectedScopesFromTransaction(engine.getDocument(), transaction);
}

export function collectErdAffectedScopesFromEvents(
  doc: Y.Doc,
  events: Y.YEvent<Y.AbstractType<unknown>>[],
): ScopeRef[] {
  const transaction = events[0]?.transaction;
  if (!(transaction instanceof Y.Transaction)) {
    return [];
  }

  return collectErdAffectedScopesFromTransaction(doc, transaction);
}

export function collectErdAffectedScopesFromTransaction(
  doc: Y.Doc,
  transaction: Y.Transaction,
): ScopeRef[] {
  const tablesMap = getTablesMap(doc);
  const edgesMap = getEdgesMap(doc);
  const groupsMap = getGroupsMap(doc);
  const affectedScopes = new Map<string, ScopeRef>();

  for (const [type, subs] of transaction.changed) {
    const changedType = type as AnyYType;
    if (isSameType(changedType, tablesMap)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'table', key);
      }
      continue;
    }
    if (isSameType(changedType, edgesMap)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'edge', key);
      }
      continue;
    }
    if (isSameType(changedType, groupsMap)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'group', key);
      }
      continue;
    }

    const parent = changedType.parent;
    if (isSameType(parent, tablesMap)) {
      addAffectedScope(affectedScopes, 'table', readParentSub(changedType));
      continue;
    }
    if (isSameType(parent, edgesMap)) {
      addAffectedScope(affectedScopes, 'edge', readParentSub(changedType));
      continue;
    }
    if (isSameType(parent, groupsMap)) {
      addAffectedScope(affectedScopes, 'group', readParentSub(changedType));
      continue;
    }

    if (parent instanceof Y.Map && isSameType(parent.parent, tablesMap)) {
      addAffectedScope(affectedScopes, 'table', readParentSub(parent));
      continue;
    }
    if (parent instanceof Y.Map && isSameType(parent.parent, edgesMap)) {
      addAffectedScope(affectedScopes, 'edge', readParentSub(parent));
      continue;
    }
    if (parent instanceof Y.Map && isSameType(parent.parent, groupsMap)) {
      addAffectedScope(affectedScopes, 'group', readParentSub(parent));
      continue;
    }

    if (parent instanceof Y.Array) {
      const arrayParent = parent.parent;
      if (
        arrayParent instanceof Y.Map &&
        isSameType(arrayParent.parent, tablesMap) &&
        readParentSub(parent) === 'columns'
      ) {
        const tableId = readParentSub(arrayParent);
        addAffectedScope(affectedScopes, 'table', tableId);
        if (changedType instanceof Y.Map) {
          const columnId = readString(changedType.get('id'));
          addAffectedScope(
            affectedScopes,
            'column',
            tableId && columnId ? buildErdColumnEntityId(tableId, columnId) : null,
          );
        }
      }
    }
  }

  return [...affectedScopes.values()];
}

function readChangedSubKeys(subs: Set<unknown>): string[] {
  const result: string[] = [];
  for (const sub of subs.keys()) {
    if (typeof sub === 'string' && sub.length > 0) {
      result.push(sub);
    }
  }
  return result;
}

function readParentSub(type: AnyYType): string | null {
  return typeof type._item?.parentSub === 'string' && type._item.parentSub.length > 0
    ? type._item.parentSub
    : null;
}

function isSameType(left: unknown, right: unknown): boolean {
  return left === right;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function addAffectedScope(
  affectedScopes: Map<string, ScopeRef>,
  kind: ScopeRef['kind'],
  id: string | null,
): void {
  if (!id) {
    return;
  }
  affectedScopes.set(`${kind}:${id}`, {
    kind,
    id,
    mode: 'shared',
  });
}
