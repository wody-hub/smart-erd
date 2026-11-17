import { isPositionBatch } from './erd-position-batch';
import {
  ensureColumnStorage,
  getColumnYMap,
  insertColumnYMap,
  deleteTableColumn,
  moveTableColumn,
  patchColumnYMap,
  readColumnYMaps,
} from '@/collaboration/yjs-columns';
import type {
  DocumentMutation,
  DocumentMutationApplyResult,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { CANVAS_HISTORY_ORIGIN, DRAG_TRANSACTION_ORIGIN } from '@/constants/canvas-history';
import type { DdlParseResult } from '@/lib/ddl-parser';
import type { DiagramDictionaryReconciliationPlan } from '@/lib/diagram-dictionary-reconciliation';
import { applyDiffToYDoc, type ApplyDiffResult } from '@/lib/erd-diff-apply';
import type { DiffPlan } from '@/lib/erd-diff-plan';
import {
  buildEdgePresentationByRelationKey,
  buildTableMetaRestoreMaps,
  buildFkPrefix,
  buildUniqueFkColumnName,
  buildUniqueName,
  populateFromDdl,
} from '@/lib/erd-ddl-yjs-utils';
import { resolveUniqueTableLabel } from '@/lib/erd-yjs-utils';
import {
  applyEdgeHandleNormalizationPatches,
  planEdgeHandleNormalization,
  normalizeEdgeHandlesInYDoc,
  syncEdgeHandlePreference,
} from '@/lib/erd-edge-yjs-utils';
import {
  buildStableEdgeId,
  type EdgeHandleSelectionValue,
  parseEdgeHandleSelectionValue,
  resolveAutoEdgeHandles,
  resolveEdgeHandlesFromPreference,
} from '@/lib/edge-handles';
import { extractColId } from '@/lib/handle-id';
import { readString } from '@/lib/yjs-read-utils';
import type {
  EdgeRoutingType,
  RelationType,
  TableHandleLayout,
  TableHeaderColor,
  Waypoint,
} from '@/types/erd';
import * as Y from 'yjs';
import {
  createGroupYMap,
  createTableYMap,
  getEdgesMap,
  getGroupsMap,
  getTablesMap,
  removeTableIdFromYArray,
  setTableYMapPosition,
} from '@/collaboration/yjsBridge';
import {
  createColumnYMap,
  createEdgeYMap,
  createWaypointsYArray,
  syncLegacyWaypointsInEdgeYMap,
} from '@/collaboration/yjsBridge';

/**
 * ERD 전용 mutation -> Y.Doc 적용기.
 *
 * core store는 이 구현을 통해서만 ERD/Yjs 세부사항과 연결된다.
 */
export class ErdDocumentMutationApplier {
  constructor(
    private readonly engine: YjsSharedDocumentEngine,
    private readonly stopHistoryCapture: () => void = () => {},
  ) {}

  apply<T = unknown>(mutation: DocumentMutation): DocumentMutationApplyResult<T> {
    switch (mutation.key) {
      case 'table:add':
        return this.toApplyResult(this.applyTableAdd(mutation));
      case 'table:delete':
        return this.toApplyResult(this.applyTableDelete(mutation));
      case 'edge:connect':
        return this.toApplyResult(this.applyEdgeConnect(mutation));
      case 'edge:add-fk-relation':
        return this.toApplyResult(this.applyEdgeAddFkRelation(mutation));
      case 'edge:delete':
        return this.toApplyResult(this.applyEdgeDelete(mutation));
      case 'edge:update-routing-type':
        return this.toApplyResult(this.applyEdgeUpdateRoutingType(mutation));
      case 'edge:update-handle-selection':
        return this.toApplyResult(this.applyEdgeUpdateHandleSelection(mutation));
      case 'edge:update-waypoints':
        return this.toApplyResult(this.applyEdgeUpdateWaypoints(mutation));
      case 'edge:reset-waypoints':
        return this.toApplyResult(this.applyEdgeResetWaypoints(mutation));
      case 'edge:normalize-handles':
        return this.toApplyResult(this.applyEdgeNormalizeHandles(mutation));
      case 'layout:apply':
      case 'preview-position:apply':
        return this.toApplyResult(this.applyPositionBatch(mutation));
      case 'table:move':
        return this.toApplyResult(this.applyTableMove(mutation));
      case 'table:rename':
        return this.toApplyResult(this.applyTableRename(mutation));
      case 'table:update-meta':
        return this.toApplyResult(this.applyTableUpdateMeta(mutation));
      case 'column:add':
        return this.toApplyResult(this.applyColumnAdd(mutation));
      case 'column:delete':
        return this.toApplyResult(this.applyColumnDelete(mutation));
      case 'column:move':
        return this.toApplyResult(this.applyColumnMove(mutation));
      case 'column:update':
        return this.toApplyResult(this.applyColumnUpdate(mutation));
      case 'group:add':
        return this.toApplyResult(this.applyGroupAdd(mutation));
      case 'group:delete':
        return this.toApplyResult(this.applyGroupDelete(mutation));
      case 'group:rename':
        return this.toApplyResult(this.applyGroupRename(mutation));
      case 'group:update-color':
        return this.toApplyResult(this.applyGroupUpdateColor(mutation));
      case 'group:update-tables':
        return this.toApplyResult(this.applyGroupUpdateTables(mutation));
      case 'ddl:import':
        return this.toApplyResult(this.applyDdlImport(mutation));
      case 'ddl:replace':
        return this.toApplyResult(this.applyDdlReplace(mutation));
      case 'diff:apply-plan':
        return this.applyDiffPlan(mutation) as DocumentMutationApplyResult<T>;
      case 'dictionary:reconcile':
        return this.toApplyResult(this.applyDictionaryReconciliation(mutation));
      default:
        return {
          applied: false,
        };
    }
  }

  private toApplyResult<T = unknown>(applied: boolean, value?: T): DocumentMutationApplyResult<T> {
    if (!applied) {
      return {
        applied: false,
      };
    }
    if (value === undefined) {
      return {
        applied: true,
      };
    }
    return {
      applied: true,
      value,
    };
  }

  private applyTableAdd(mutation: DocumentMutation): boolean {
    const nextName =
      typeof mutation.payload?.name === 'string' && mutation.payload.name.trim().length > 0
        ? mutation.payload.name.trim()
        : null;
    const requestedTableId =
      typeof mutation.payload?.tableId === 'string' && mutation.payload.tableId.trim().length > 0
        ? mutation.payload.tableId.trim()
        : null;
    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    const tableId = requestedTableId ?? `table-${crypto.randomUUID()}`;
    const label = nextName ?? `Table ${tablesMap.size + 1}`;

    let positionX = 100;
    let positionY = 100;
    tablesMap.forEach((tableYMap) => {
      const candidateX =
        typeof tableYMap.get('positionX') === 'number' ? Number(tableYMap.get('positionX')) : 0;
      const candidateY =
        typeof tableYMap.get('positionY') === 'number' ? Number(tableYMap.get('positionY')) : 100;
      positionX = Math.max(positionX, candidateX + 260);
      positionY = candidateY;
    });

    doc.transact(() => {
      tablesMap.set(
        tableId,
        createTableYMap(label, { x: positionX, y: positionY }, [
          {
            id: `col-${crypto.randomUUID()}`,
            name: 'id',
            type: 'BIGINT',
            pk: true,
            nullable: false,
          },
        ]),
      );
    }, CANVAS_HISTORY_ORIGIN.USER_TABLE);
    return true;
  }

  private applyTableDelete(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    if (!tableId) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    if (!tablesMap.has(tableId)) {
      return false;
    }

    doc.transact(() => {
      tablesMap.delete(tableId);
      const edgesMap = getEdgesMap(doc);
      const toDelete: string[] = [];
      edgesMap.forEach((edgeYMap, edgeId) => {
        if (edgeYMap.get('source') === tableId || edgeYMap.get('target') === tableId) {
          toDelete.push(edgeId);
        }
      });
      for (const edgeId of toDelete) {
        edgesMap.delete(edgeId);
      }

      const groupsMap = getGroupsMap(doc);
      groupsMap.forEach((groupYMap) => {
        const tableIdsYArray = groupYMap.get('tableIds');
        if (tableIdsYArray instanceof Y.Array) {
          removeTableIdFromYArray(tableIdsYArray, tableId);
        }
      });
    }, CANVAS_HISTORY_ORIGIN.USER_TABLE);
    return true;
  }

  /** 전체 검증과 계획을 마친 위치 배치를 단일 transaction으로 반영한다. */
  private applyPositionBatch(mutation: DocumentMutation): boolean {
    const batch = mutation.payload;
    if (!isPositionBatch(batch)) return false;
    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    const changes: { tableYMap: Y.Map<unknown>; position: { x: number; y: number } }[] = [];
    for (const entry of batch.entries) {
      const tableYMap = tablesMap.get(entry.tableId);
      if (
        !tableYMap ||
        tableYMap.get('positionX') !== entry.from.x ||
        tableYMap.get('positionY') !== entry.from.y
      )
        return false;
      if (entry.from.x !== entry.to.x || entry.from.y !== entry.to.y) {
        changes.push({ tableYMap, position: entry.to });
      }
    }
    const targetIds = batch.entries.map((entry) => entry.tableId);
    for (const id of targetIds) {
      if (!mutation.affectedScopes.some((scope) => scope.kind === 'table' && scope.id === id)) {
        mutation.affectedScopes.push({ kind: 'table', id, mode: 'exclusive' });
      }
    }
    if (changes.length === 0) return true;
    const patches = planEdgeHandleNormalization({
      doc,
      nodeIds: targetIds,
      positions: new Map(batch.entries.map((entry) => [entry.tableId, entry.to])),
    });
    for (const { edgeId } of patches) {
      if (!mutation.affectedScopes.some((scope) => scope.kind === 'edge' && scope.id === edgeId)) {
        mutation.affectedScopes.push({ kind: 'edge', id: edgeId, mode: 'exclusive' });
      }
    }
    const origin =
      mutation.key === 'layout:apply'
        ? CANVAS_HISTORY_ORIGIN.USER_LAYOUT
        : CANVAS_HISTORY_ORIGIN.USER_PREVIEW_POSITION;
    this.stopHistoryCapture();
    try {
      doc.transact(() => {
        for (const { tableYMap, position } of changes) setTableYMapPosition(tableYMap, position);
        applyEdgeHandleNormalizationPatches(patches);
      }, origin);
    } finally {
      this.stopHistoryCapture();
    }
    return true;
  }

  private applyTableMove(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    const positionX =
      typeof mutation.payload?.positionX === 'number' ? mutation.payload.positionX : null;
    const positionY =
      typeof mutation.payload?.positionY === 'number' ? mutation.payload.positionY : null;

    if (!tableId || positionX === null || positionY === null) {
      return false;
    }

    const doc = this.engine.getDocument();
    let resolved = false;
    doc.transact(() => {
      const tableYMap = getTablesMap(doc).get(tableId);
      if (!tableYMap) {
        return;
      }
      resolved = true;
      const currentPositionX = tableYMap.get('positionX');
      const currentPositionY = tableYMap.get('positionY');
      if (currentPositionX === positionX && currentPositionY === positionY) {
        return;
      }
      setTableYMapPosition(tableYMap, { x: positionX, y: positionY });
    }, DRAG_TRANSACTION_ORIGIN);
    return resolved;
  }

  private applyTableRename(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    const nextLabel =
      typeof mutation.payload?.label === 'string' ? mutation.payload.label.trim() : null;

    if (!tableId || !nextLabel) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    const tableYMap = tablesMap.get(tableId);
    if (!tableYMap) {
      return false;
    }

    const currentLabel = tableYMap.get('label');
    if (currentLabel === nextLabel) {
      return true;
    }

    const uniqueLabel = resolveUniqueTableLabel(tablesMap, tableId, nextLabel);
    let applied = false;
    doc.transact(() => {
      tableYMap.set('label', uniqueLabel);
      applied = true;
    }, CANVAS_HISTORY_ORIGIN.USER_TABLE);
    return applied;
  }

  private applyTableUpdateMeta(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    if (!tableId) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tableYMap = getTablesMap(doc).get(tableId);
    if (!tableYMap) {
      return false;
    }

    const entries = Object.entries(mutation.payload ?? {}).filter(([key]) => key !== 'tableId');
    if (entries.length === 0) {
      return false;
    }

    let resolved = false;
    doc.transact(() => {
      resolved = true;
      for (const [key, value] of entries) {
        if (key === 'label') {
          const nextLabel = typeof value === 'string' ? value.trim() : null;
          if (!nextLabel) {
            if (tableYMap.has('label')) {
              tableYMap.delete('label');
            }
            continue;
          }
          const uniqueLabel = resolveUniqueTableLabel(getTablesMap(doc), tableId, nextLabel);
          if (!Object.is(tableYMap.get('label'), uniqueLabel)) {
            tableYMap.set('label', uniqueLabel);
          }
          continue;
        }
        if (value === undefined || value === null) {
          if (tableYMap.has(key)) {
            tableYMap.delete(key);
          }
          continue;
        }
        if (key === 'headerColor' && value === 'default') {
          if (tableYMap.has('headerColor')) {
            tableYMap.delete('headerColor');
          }
          continue;
        }
        if (key === 'handleLayout' && value === 'split') {
          if (tableYMap.has('handleLayout')) {
            tableYMap.delete('handleLayout');
          }
          continue;
        }
        if (!Object.is(tableYMap.get(key), value)) {
          tableYMap.set(key, value);
        }
      }
    }, CANVAS_HISTORY_ORIGIN.USER_TABLE);
    return resolved;
  }

  /**
   * 존재하는 컬럼의 변경 필드를 반영하고 관계 유형을 갱신한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyColumnUpdate(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    const colId = typeof mutation.payload?.colId === 'string' ? mutation.payload.colId : null;
    if (!tableId || !colId) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tableYMap = getTablesMap(doc).get(tableId);
    if (!tableYMap) {
      return false;
    }
    const entries = Object.entries(mutation.payload ?? {}).filter(
      ([key]) => key !== 'tableId' && key !== 'colId' && key !== 'id',
    );
    if (entries.length === 0) {
      return false;
    }

    ensureColumnStorage(tableYMap);
    let relationTypeNeedsRecompute = false;
    let resolved = false;
    doc.transact(() => {
      const colYMap = getColumnYMap(tableYMap, colId);
      if (!colYMap) {
        return;
      }
      resolved = true;
      for (const [key, value] of entries) {
        if (value === undefined) {
          if (colYMap.has(key)) {
            colYMap.delete(key);
            if (key === 'pk' || key === 'fk') {
              relationTypeNeedsRecompute = true;
            }
          }
          continue;
        }
        if (!Object.is(colYMap.get(key), value)) {
          colYMap.set(key, value);
          if (key === 'pk' || key === 'fk') {
            relationTypeNeedsRecompute = true;
          }
        }
      }

      if (relationTypeNeedsRecompute) {
        const isPk = !!colYMap.get('pk');
        const isFk = !!colYMap.get('fk');
        getEdgesMap(doc).forEach((edgeYMap) => {
          const targetHandle = edgeYMap.get('targetHandle');
          if (
            edgeYMap.get('target') === tableId &&
            typeof targetHandle === 'string' &&
            targetHandle.startsWith(`${tableId}-${colId}-target`)
          ) {
            const nextRelationType = isPk && isFk ? 'identifying' : 'non-identifying';
            if (!Object.is(edgeYMap.get('relationType'), nextRelationType)) {
              edgeYMap.set('relationType', nextRelationType);
            }
          }
        });
      }
    }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);

    return resolved;
  }

  /**
   * 새 ID의 컬럼 본체와 순서를 추가한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyColumnAdd(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    if (!tableId) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tableYMap = getTablesMap(doc).get(tableId);
    if (!tableYMap) {
      return false;
    }

    ensureColumnStorage(tableYMap);
    doc.transact(() => {
      const id = `col-${crypto.randomUUID()}`;
      insertColumnYMap(
        tableYMap,
        id,
        createColumnYMap({
          id,
          name: 'column',
          type: 'VARCHAR(255)',
          nullable: true,
        }),
      );
    }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);
    return true;
  }

  /**
   * 컬럼 본체와 순서 및 참조 엣지를 삭제한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyColumnDelete(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    const colId = typeof mutation.payload?.colId === 'string' ? mutation.payload.colId : null;
    if (!tableId || !colId) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tableYMap = getTablesMap(doc).get(tableId);
    if (!tableYMap) {
      return false;
    }
    ensureColumnStorage(tableYMap);
    if (!getColumnYMap(tableYMap, colId)) return false;

    const handlePrefix = `${tableId}-${colId}`;
    doc.transact(() => {
      deleteTableColumn(tableYMap, colId);
      const edgesMap = getEdgesMap(doc);
      const toDelete: string[] = [];
      edgesMap.forEach((edgeYMap, edgeId) => {
        const sourceHandle = edgeYMap.get('sourceHandle');
        const targetHandle = edgeYMap.get('targetHandle');
        if (
          (typeof sourceHandle === 'string' && sourceHandle.startsWith(handlePrefix)) ||
          (typeof targetHandle === 'string' && targetHandle.startsWith(handlePrefix))
        ) {
          toDelete.push(edgeId);
        }
      });
      for (const edgeId of toDelete) {
        edgesMap.delete(edgeId);
      }
    }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);
    return true;
  }

  /**
   * 컬럼 본체를 유지하며 ID 순서만 이동한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyColumnMove(mutation: DocumentMutation): boolean {
    const tableId = typeof mutation.payload?.tableId === 'string' ? mutation.payload.tableId : null;
    const fromIndex =
      typeof mutation.payload?.fromIndex === 'number' ? mutation.payload.fromIndex : null;
    const toIndex = typeof mutation.payload?.toIndex === 'number' ? mutation.payload.toIndex : null;
    if (!tableId || fromIndex === null || toIndex === null) {
      return false;
    }
    if (fromIndex === toIndex) {
      return true;
    }

    const doc = this.engine.getDocument();
    const tableYMap = getTablesMap(doc).get(tableId);
    if (!tableYMap) {
      return false;
    }
    ensureColumnStorage(tableYMap);
    let moved = false;
    doc.transact(() => {
      moved = moveTableColumn(tableYMap, fromIndex, toIndex);
    }, CANVAS_HISTORY_ORIGIN.USER_COLUMN);
    return moved;
  }

  private applyGroupAdd(mutation: DocumentMutation): boolean {
    const doc = this.engine.getDocument();
    const groupsMap = getGroupsMap(doc);
    const nextLabel =
      typeof mutation.payload?.label === 'string' && mutation.payload.label.trim().length > 0
        ? mutation.payload.label.trim()
        : `Group ${groupsMap.size + 1}`;
    const requestedGroupId =
      typeof mutation.payload?.groupId === 'string' && mutation.payload.groupId.trim().length > 0
        ? mutation.payload.groupId.trim()
        : null;

    doc.transact(() => {
      groupsMap.set(requestedGroupId ?? `group-${crypto.randomUUID()}`, createGroupYMap(nextLabel));
    }, CANVAS_HISTORY_ORIGIN.USER_GROUP);
    return true;
  }

  private applyGroupDelete(mutation: DocumentMutation): boolean {
    const groupId = readString(mutation.payload?.groupId);
    if (!groupId) {
      return false;
    }
    const doc = this.engine.getDocument();
    const groupsMap = getGroupsMap(doc);
    if (!groupsMap.has(groupId)) {
      return false;
    }
    doc.transact(() => {
      groupsMap.delete(groupId);
    }, CANVAS_HISTORY_ORIGIN.USER_GROUP);
    return true;
  }

  private applyGroupRename(mutation: DocumentMutation): boolean {
    const groupId = readString(mutation.payload?.groupId);
    const label = readString(mutation.payload?.label)?.trim();
    if (!groupId || !label) {
      return false;
    }
    const doc = this.engine.getDocument();
    const groupYMap = getGroupsMap(doc).get(groupId);
    if (!groupYMap) {
      return false;
    }
    if (groupYMap.get('label') === label) {
      return true;
    }
    doc.transact(() => {
      groupYMap.set('label', label);
    }, CANVAS_HISTORY_ORIGIN.USER_GROUP);
    return true;
  }

  private applyGroupUpdateColor(mutation: DocumentMutation): boolean {
    const groupId = readString(mutation.payload?.groupId);
    const color = this.readGroupColor(mutation.payload?.color);
    if (!groupId || color == null) {
      return false;
    }
    const doc = this.engine.getDocument();
    const groupYMap = getGroupsMap(doc).get(groupId);
    if (!groupYMap) {
      return false;
    }
    doc.transact(() => {
      if (color === 'default') {
        groupYMap.delete('color');
        return;
      }
      groupYMap.set('color', color);
    }, CANVAS_HISTORY_ORIGIN.USER_GROUP);
    return true;
  }

  private applyGroupUpdateTables(mutation: DocumentMutation): boolean {
    const groupId = readString(mutation.payload?.groupId);
    if (!groupId) {
      return false;
    }
    const toAdd = this.readStringArray(mutation.payload?.toAdd);
    const toRemove = this.readStringArray(mutation.payload?.toRemove);
    if (toAdd.length === 0 && toRemove.length === 0) {
      return true;
    }

    const doc = this.engine.getDocument();
    const groupsMap = getGroupsMap(doc);
    const groupYMap = groupsMap.get(groupId);
    if (!groupYMap) {
      return false;
    }
    const tableIdsYArray = groupYMap.get('tableIds');
    if (!(tableIdsYArray instanceof Y.Array)) {
      return false;
    }
    const tablesMap = getTablesMap(doc);

    doc.transact(() => {
      for (const tableId of toRemove) {
        removeTableIdFromYArray(tableIdsYArray, tableId);
      }

      const existing = new Set<string>();
      tableIdsYArray.forEach((id) => existing.add(id));
      const toInsert = toAdd.filter((tableId) => tablesMap.has(tableId) && !existing.has(tableId));
      if (toInsert.length > 0) {
        tableIdsYArray.push(toInsert);
      }
    }, CANVAS_HISTORY_ORIGIN.USER_GROUP);
    return true;
  }

  private applyDdlImport(mutation: DocumentMutation): boolean {
    const result = this.readDdlParseResult(mutation.payload?.result);
    if (!result || result.tables.length === 0) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    const edgesMap = getEdgesMap(doc);
    const existingNodes = this.readCurrentNodes();
    const assigned = new Set(existingNodes.map((node) => node.data.label));
    const startY =
      existingNodes.length > 0
        ? Math.max(...existingNodes.map((node) => node.position?.y ?? 0)) + 300
        : 100;

    doc.transact(() => {
      populateFromDdl(tablesMap, edgesMap, result, {
        resolveTableName: (name) => {
          const unique = buildUniqueName(name, [...assigned]);
          assigned.add(unique);
          return unique;
        },
        startY,
      });
    }, CANVAS_HISTORY_ORIGIN.SYSTEM_DDL_IMPORT);
    return true;
  }

  private applyDdlReplace(mutation: DocumentMutation): boolean {
    const result = this.readDdlParseResult(mutation.payload?.result);
    if (!result || result.tables.length === 0) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    const edgesMap = getEdgesMap(doc);
    const groupsMap = getGroupsMap(doc);
    const existingNodes = this.readCurrentNodes();
    const existingEdges = this.readCurrentEdges();
    const assigned = new Set<string>();
    const edgePresentationByRelationKey = buildEdgePresentationByRelationKey(
      existingNodes,
      existingEdges,
    );
    const { tableMetaByPhysicalName, tableMetaByUniqueLogicalName } =
      buildTableMetaRestoreMaps(existingNodes);

    doc.transact(() => {
      for (const key of [...tablesMap.keys()]) {
        tablesMap.delete(key);
      }
      for (const key of [...edgesMap.keys()]) {
        edgesMap.delete(key);
      }
      groupsMap.forEach((groupYMap) => {
        const tableIdsYArray = groupYMap.get('tableIds');
        if (tableIdsYArray instanceof Y.Array && tableIdsYArray.length > 0) {
          tableIdsYArray.delete(0, tableIdsYArray.length);
        }
      });
      populateFromDdl(tablesMap, edgesMap, result, {
        resolveTableName: (name) => {
          const unique = buildUniqueName(name, [...assigned]);
          assigned.add(unique);
          return unique;
        },
        startY: 100,
        edgePresentationByRelationKey,
        tableMetaByPhysicalName,
        tableMetaByUniqueLogicalName,
      });
    }, CANVAS_HISTORY_ORIGIN.SYSTEM_DDL_IMPORT);
    return true;
  }

  private applyDiffPlan(mutation: DocumentMutation): DocumentMutationApplyResult<ApplyDiffResult> {
    const plan = this.readDiffPlan(mutation.payload?.plan);
    if (!plan) {
      return {
        applied: false,
      };
    }

    const result = applyDiffToYDoc(
      this.engine.getDocument(),
      plan,
      CANVAS_HISTORY_ORIGIN.SYSTEM_CODE_SYNC,
    );
    return this.toApplyResult(true, result);
  }

  /**
   * 사전 변경 필드만 현재 컬럼 본체에 반영한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyDictionaryReconciliation(mutation: DocumentMutation): boolean {
    const plan = this.readDictionaryReconciliationPlan(mutation.payload?.plan);
    if (!plan || (plan.tableMetaUpdates.length === 0 && plan.columnUpdates.length === 0)) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tables = getTablesMap(doc);
    for (const tableId of new Set(plan.columnUpdates.map((update) => update.nodeId))) {
      const table = tables.get(tableId);
      if (table) ensureColumnStorage(table);
    }
    doc.transact(() => {
      const tablesMap = getTablesMap(doc);

      for (const tableUpdate of plan.tableMetaUpdates) {
        const tableYMap = tablesMap.get(tableUpdate.nodeId);
        if (!tableYMap) {
          continue;
        }
        for (const [key, value] of Object.entries(tableUpdate.updates)) {
          if (value === undefined || value === null) {
            tableYMap.delete(key);
          } else {
            tableYMap.set(key, value);
          }
        }
      }

      for (const columnUpdate of plan.columnUpdates) {
        const tableYMap = tablesMap.get(columnUpdate.nodeId);
        if (!tableYMap) {
          continue;
        }
        const columnYMap = getColumnYMap(tableYMap, columnUpdate.colId);
        if (!columnYMap) {
          continue;
        }
        patchColumnYMap(tableYMap, columnUpdate.colId, columnUpdate.updates);
      }
    }, CANVAS_HISTORY_ORIGIN.SYSTEM_DICTIONARY_RECONCILE);
    return true;
  }

  /**
   * 기존 컬럼을 연결하고 변경된 FK 필드만 반영한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyEdgeConnect(mutation: DocumentMutation): boolean {
    const requestedEdgeId = readString(mutation.payload?.edgeId);
    const sourceTableId = readString(mutation.payload?.sourceTableId);
    const targetTableId = readString(mutation.payload?.targetTableId);
    const sourceHandle = readString(mutation.payload?.sourceHandle);
    const targetHandle = readString(mutation.payload?.targetHandle);
    const relationType = this.readRelationType(mutation.payload?.relationType);
    if (!sourceTableId || !targetTableId || !sourceHandle || !targetHandle || !relationType) {
      return false;
    }

    const sourceColumnId = extractColId(sourceHandle, sourceTableId);
    const targetColumnId = extractColId(targetHandle, targetTableId);
    const doc = this.engine.getDocument();
    const sourceTableYMap = getTablesMap(doc).get(sourceTableId);
    const targetTableYMap = getTablesMap(doc).get(targetTableId);
    if (!sourceTableYMap || !targetTableYMap) {
      return false;
    }
    const sourceColumn = this.findColumnEntity(sourceTableYMap, sourceColumnId);
    const targetColumn = this.findColumnEntity(targetTableYMap, targetColumnId);
    if (!sourceColumn || !targetColumn) {
      return false;
    }

    const edgeId =
      requestedEdgeId ??
      buildStableEdgeId({
        parentTable: readString(sourceTableYMap.get('label')) ?? sourceTableId,
        parentColumn: sourceColumn.name,
        childTable: readString(targetTableYMap.get('label')) ?? targetTableId,
        childColumn: targetColumn.name,
      });

    ensureColumnStorage(targetTableYMap);
    doc.transact(() => {
      const edgeYMap = createEdgeYMap(
        sourceTableId,
        targetTableId,
        sourceHandle,
        targetHandle,
        relationType,
      );
      getEdgesMap(doc).set(edgeId, edgeYMap);
      syncLegacyWaypointsInEdgeYMap(edgeYMap);
      this.applyTargetFkFlags(targetTableYMap, targetColumnId, relationType);
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  /**
   * 새 FK 컬럼과 관계를 추가한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyEdgeAddFkRelation(mutation: DocumentMutation): boolean {
    const parentTableId = readString(mutation.payload?.parentTableId);
    const childTableId = readString(mutation.payload?.childTableId);
    const relationType = this.readRelationType(mutation.payload?.relationType);
    if (!parentTableId || !childTableId || !relationType) {
      return false;
    }

    const doc = this.engine.getDocument();
    const tablesMap = getTablesMap(doc);
    const parentTableYMap = tablesMap.get(parentTableId);
    const childTableYMap = tablesMap.get(childTableId);
    if (!parentTableYMap || !childTableYMap) {
      return false;
    }

    const parentColumns = this.readColumns(parentTableYMap).filter((column) => column.pk);
    if (parentColumns.length === 0) {
      return false;
    }

    ensureColumnStorage(childTableYMap);
    const childColumns = this.readColumns(childTableYMap);
    const existingNames = childColumns.map((column) => column.name);
    const parentLabel = readString(parentTableYMap.get('label')) ?? parentTableId;
    const prefix = buildFkPrefix(parentLabel);
    const parentNode = this.readTableNodeLike(parentTableId, parentTableYMap);
    const childNode = this.readTableNodeLike(childTableId, childTableYMap);
    if (!parentNode || !childNode) {
      return false;
    }

    doc.transact(() => {
      const assignedNames = [...existingNames];
      for (const parentColumn of parentColumns) {
        const baseName = prefix ? `${prefix}_${parentColumn.name}` : parentColumn.name;
        const fkName = buildUniqueFkColumnName(baseName, assignedNames);
        assignedNames.push(fkName);
        const fkColumnId = `col-${crypto.randomUUID()}`;
        insertColumnYMap(
          childTableYMap,
          fkColumnId,
          createColumnYMap({
            id: fkColumnId,
            name: fkName,
            type: parentColumn.type ?? 'VARCHAR(255)',
            pk: relationType === 'identifying' ? true : undefined,
            fk: true,
            nullable: relationType !== 'identifying',
            logicalName: parentColumn.logicalName,
            domainId: parentColumn.domainId,
          }),
        );

        const handles = resolveAutoEdgeHandles({
          sourceNode: parentNode,
          targetNode: childNode,
          sourceColId: parentColumn.id,
          targetColId: fkColumnId,
        });
        const edgeId = buildStableEdgeId({
          parentTable: parentLabel,
          parentColumn: parentColumn.name,
          childTable: readString(childTableYMap.get('label')) ?? childTableId,
          childColumn: fkName,
        });
        const edgeYMap = createEdgeYMap(
          parentTableId,
          childTableId,
          handles.sourceHandle,
          handles.targetHandle,
          relationType,
        );
        getEdgesMap(doc).set(edgeId, edgeYMap);
        syncLegacyWaypointsInEdgeYMap(edgeYMap);
      }
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  /**
   * 엣지와 요청된 FK 컬럼을 삭제한다.
   * @param mutation 문서 mutation
   * @returns 적용 여부
   */
  private applyEdgeDelete(mutation: DocumentMutation): boolean {
    const edgeId = readString(mutation.payload?.edgeId);
    if (!edgeId) {
      return false;
    }

    const removeFkColumn = mutation.payload?.removeFkColumn === true;
    const doc = this.engine.getDocument();
    const edgesMap = getEdgesMap(doc);
    const edgeYMap = edgesMap.get(edgeId);
    if (!edgeYMap) {
      return false;
    }

    if (removeFkColumn) {
      const target = readString(edgeYMap.get('target'));
      const table = target ? getTablesMap(doc).get(target) : undefined;
      if (table) ensureColumnStorage(table);
    }
    doc.transact(() => {
      if (removeFkColumn) {
        const targetTableId = readString(edgeYMap.get('target'));
        const targetHandle = readString(edgeYMap.get('targetHandle'));
        if (targetTableId && targetHandle) {
          const targetColumnId = extractColId(targetHandle, targetTableId);
          const targetTableYMap = getTablesMap(doc).get(targetTableId);
          if (targetTableYMap) deleteTableColumn(targetTableYMap, targetColumnId);
        }
      }
      edgesMap.delete(edgeId);
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  private applyEdgeUpdateRoutingType(mutation: DocumentMutation): boolean {
    const edgeId = readString(mutation.payload?.edgeId);
    const routingType = this.readEdgeRoutingType(mutation.payload?.routingType);
    if (!edgeId || !routingType) {
      return false;
    }
    const doc = this.engine.getDocument();
    const edgeYMap = getEdgesMap(doc).get(edgeId);
    if (!edgeYMap) {
      return false;
    }
    doc.transact(() => {
      edgeYMap.set('routingType', routingType);
      if (routingType !== 'straight') {
        edgeYMap.delete('waypoints');
      }
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  private applyEdgeUpdateHandleSelection(mutation: DocumentMutation): boolean {
    const edgeId = readString(mutation.payload?.edgeId);
    const selection = readString(mutation.payload?.selection);
    if (!edgeId || !selection) {
      return false;
    }

    const doc = this.engine.getDocument();
    const edgeYMap = getEdgesMap(doc).get(edgeId);
    if (!edgeYMap) {
      return false;
    }

    const sourceTableId = readString(edgeYMap.get('source'));
    const targetTableId = readString(edgeYMap.get('target'));
    const sourceHandle = readString(edgeYMap.get('sourceHandle'));
    const targetHandle = readString(edgeYMap.get('targetHandle'));
    if (!sourceTableId || !targetTableId || !sourceHandle || !targetHandle) {
      return false;
    }

    const sourceTableYMap = getTablesMap(doc).get(sourceTableId);
    const targetTableYMap = getTablesMap(doc).get(targetTableId);
    if (!sourceTableYMap || !targetTableYMap) {
      return false;
    }

    const sourceNode = this.readTableNodeLike(sourceTableId, sourceTableYMap);
    const targetNode = this.readTableNodeLike(targetTableId, targetTableYMap);
    if (!sourceNode || !targetNode) {
      return false;
    }

    const sourceColId = extractColId(sourceHandle, sourceTableId);
    const targetColId = extractColId(targetHandle, targetTableId);
    const preference = parseEdgeHandleSelectionValue(selection as EdgeHandleSelectionValue);
    const resolution = resolveEdgeHandlesFromPreference({
      sourceNode,
      targetNode,
      sourceColId,
      targetColId,
      handleMode: preference.handleMode,
      sourceSide: preference.sourceSide,
      targetSide: preference.targetSide,
    });
    const currentRoutingType =
      this.readEdgeRoutingType(edgeYMap.get('routingType')) ?? 'smoothstep';
    const handlesChanged =
      edgeYMap.get('sourceHandle') !== resolution.sourceHandle ||
      edgeYMap.get('targetHandle') !== resolution.targetHandle;

    doc.transact(() => {
      edgeYMap.set('sourceHandle', resolution.sourceHandle);
      edgeYMap.set('targetHandle', resolution.targetHandle);
      syncEdgeHandlePreference(edgeYMap, resolution);
      if (currentRoutingType === 'straight' && handlesChanged) {
        edgeYMap.delete('waypoints');
      }
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  private applyEdgeUpdateWaypoints(mutation: DocumentMutation): boolean {
    const edgeId = readString(mutation.payload?.edgeId);
    const waypoints = this.readWaypoints(mutation.payload?.waypoints);
    if (!edgeId || !waypoints) {
      return false;
    }
    const doc = this.engine.getDocument();
    const edgeYMap = getEdgesMap(doc).get(edgeId);
    if (!edgeYMap) {
      return false;
    }
    doc.transact(() => {
      if (waypoints.length === 0) {
        edgeYMap.delete('waypoints');
        return;
      }
      edgeYMap.set('waypoints', createWaypointsYArray(waypoints));
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  private applyEdgeResetWaypoints(mutation: DocumentMutation): boolean {
    const edgeId = readString(mutation.payload?.edgeId);
    if (!edgeId) {
      return false;
    }
    const doc = this.engine.getDocument();
    const edgeYMap = getEdgesMap(doc).get(edgeId);
    if (!edgeYMap) {
      return false;
    }
    doc.transact(() => {
      edgeYMap.delete('waypoints');
    }, CANVAS_HISTORY_ORIGIN.USER_EDGE);
    return true;
  }

  private applyEdgeNormalizeHandles(mutation: DocumentMutation): boolean {
    const nodeIds = Array.isArray(mutation.payload?.nodeIds)
      ? mutation.payload.nodeIds.filter(
          (nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.length > 0,
        )
      : undefined;
    const reason =
      mutation.payload?.reason === 'table-move' ||
      mutation.payload?.reason === 'table-meta' ||
      mutation.payload?.reason === 'layout' ||
      mutation.payload?.reason === 'edge'
        ? mutation.payload.reason
        : 'edge';
    const doc = this.engine.getDocument();

    doc.transact(() => {
      normalizeEdgeHandlesInYDoc({ doc, nodeIds });
    }, this.resolveNormalizeOrigin(reason));
    return true;
  }

  private readRelationType(value: unknown): RelationType | null {
    return value === 'identifying' || value === 'non-identifying' ? value : null;
  }

  private readEdgeRoutingType(value: unknown): EdgeRoutingType | null {
    return value === 'smoothstep' || value === 'straight' ? value : null;
  }

  private readGroupColor(value: unknown): TableHeaderColor | 'default' | null {
    return value === 'default' ||
      value === 'supporting' ||
      value === 'attention' ||
      value === 'red' ||
      value === 'orange' ||
      value === 'amber' ||
      value === 'green' ||
      value === 'teal' ||
      value === 'blue' ||
      value === 'indigo' ||
      value === 'purple' ||
      value === 'pink'
      ? value
      : null;
  }

  private readWaypoints(value: unknown): Waypoint[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    return value.filter(
      (waypoint): waypoint is Waypoint =>
        !!waypoint &&
        typeof waypoint === 'object' &&
        Number.isFinite((waypoint as { x?: unknown }).x) &&
        Number.isFinite((waypoint as { y?: unknown }).y),
    );
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  private readDdlParseResult(value: unknown): DdlParseResult | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as DdlParseResult;
    return Array.isArray(candidate.tables) &&
      Array.isArray(candidate.relations) &&
      Array.isArray(candidate.errors) &&
      Array.isArray(candidate.diagnostics) &&
      Array.isArray(candidate.tableRanges)
      ? candidate
      : null;
  }

  private readDiffPlan(value: unknown): DiffPlan | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as DiffPlan;
    return Array.isArray(candidate.tables) && Array.isArray(candidate.edges) ? candidate : null;
  }

  private readDictionaryReconciliationPlan(
    value: unknown,
  ): DiagramDictionaryReconciliationPlan | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as DiagramDictionaryReconciliationPlan;
    return Array.isArray(candidate.tableMetaUpdates) && Array.isArray(candidate.columnUpdates)
      ? candidate
      : null;
  }

  /**
   * 현재 스키마에서 테이블과 컬럼 스냅샷을 읽는다.
   * @returns 테이블 노드 목록
   */
  private readCurrentNodes(): Array<{
    id: string;
    position: { x: number; y: number };
    data: {
      label: string;
      logicalTableName?: string;
      tableTermId?: number;
      headerColor?: TableHeaderColor;
      handleLayout?: TableHandleLayout;
      columns: Array<{
        id: string;
        name: string;
        type: string;
        pk?: boolean;
        fk?: boolean;
        nullable?: boolean;
        autoIncrement?: boolean;
        logicalName?: string;
        termId?: number;
        domainId?: number;
      }>;
    };
  }> {
    const doc = this.engine.getDocument();
    const nodes: ReturnType<ErdDocumentMutationApplier['readCurrentNodes']> = [];
    getTablesMap(doc).forEach((tableYMap, tableId) => {
      const positionX = tableYMap.get('positionX');
      const positionY = tableYMap.get('positionY');
      if (typeof positionX !== 'number' || typeof positionY !== 'number') {
        return;
      }
      const columns = this.readColumns(tableYMap).map((column) => ({
        id: column.id,
        name: column.name,
        type: column.type ?? 'VARCHAR(255)',
        pk: column.pk,
        fk: (getColumnYMap(tableYMap, column.id)?.get('fk') as boolean | undefined) ?? undefined,
        nullable:
          (getColumnYMap(tableYMap, column.id)?.get('nullable') as boolean | undefined) ??
          undefined,
        autoIncrement:
          (getColumnYMap(tableYMap, column.id)?.get('autoIncrement') as boolean | undefined) ??
          undefined,
        logicalName: column.logicalName,
        termId:
          (getColumnYMap(tableYMap, column.id)?.get('termId') as number | undefined) ?? undefined,
        domainId: column.domainId,
      }));
      nodes.push({
        id: tableId,
        position: { x: positionX, y: positionY },
        data: {
          label: readString(tableYMap.get('label')) ?? tableId,
          logicalTableName: readString(tableYMap.get('logicalTableName')) ?? undefined,
          tableTermId:
            typeof tableYMap.get('tableTermId') === 'number'
              ? Number(tableYMap.get('tableTermId'))
              : undefined,
          headerColor: this.readGroupColor(tableYMap.get('headerColor')) ?? undefined,
          handleLayout:
            tableYMap.get('handleLayout') === 'split' ||
            tableYMap.get('handleLayout') === 'left' ||
            tableYMap.get('handleLayout') === 'right'
              ? (tableYMap.get('handleLayout') as TableHandleLayout)
              : undefined,
          columns,
        },
      });
    });
    return nodes;
  }

  private readCurrentEdges(): Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    data?: {
      relationType?: RelationType;
      routingType?: EdgeRoutingType;
      handleMode?: 'auto' | 'manual';
      sourceSide?: 'left' | 'right';
      targetSide?: 'left' | 'right';
      waypoints?: Waypoint[];
    };
  }> {
    const doc = this.engine.getDocument();
    const edges: ReturnType<ErdDocumentMutationApplier['readCurrentEdges']> = [];
    getEdgesMap(doc).forEach((edgeYMap, edgeId) => {
      edges.push({
        id: edgeId,
        source: readString(edgeYMap.get('source')) ?? '',
        target: readString(edgeYMap.get('target')) ?? '',
        sourceHandle: readString(edgeYMap.get('sourceHandle')) ?? undefined,
        targetHandle: readString(edgeYMap.get('targetHandle')) ?? undefined,
        data: {
          relationType: this.readRelationType(edgeYMap.get('relationType')) ?? undefined,
          routingType: this.readEdgeRoutingType(edgeYMap.get('routingType')) ?? undefined,
          handleMode:
            edgeYMap.get('handleMode') === 'manual' || edgeYMap.get('handleMode') === 'auto'
              ? (edgeYMap.get('handleMode') as 'auto' | 'manual')
              : undefined,
          sourceSide:
            edgeYMap.get('sourceSide') === 'left' || edgeYMap.get('sourceSide') === 'right'
              ? (edgeYMap.get('sourceSide') as 'left' | 'right')
              : undefined,
          targetSide:
            edgeYMap.get('targetSide') === 'left' || edgeYMap.get('targetSide') === 'right'
              ? (edgeYMap.get('targetSide') as 'left' | 'right')
              : undefined,
          waypoints: this.readWaypoints(edgeYMap.get('waypoints')) ?? undefined,
        },
      });
    });
    return edges;
  }

  /**
   * 현재 스키마의 컬럼 엔티티를 조회한다.
   * @param tableYMap 테이블
   * @param columnId 컬럼 ID
   * @returns 컬럼 엔티티 또는 null
   */
  private findColumnEntity(
    tableYMap: Y.Map<unknown>,
    columnId: string,
  ): {
    id: string;
    name: string;
    type?: string;
    pk?: boolean;
    logicalName?: string;
    domainId?: number;
  } | null {
    const columnYMap = getColumnYMap(tableYMap, columnId);
    if (!columnYMap) {
      return null;
    }
    const name = readString(columnYMap.get('name'));
    if (!name) {
      return null;
    }
    return {
      id: columnId,
      name,
      type: readString(columnYMap.get('type')) ?? undefined,
      pk: columnYMap.get('pk') === true,
      logicalName: readString(columnYMap.get('logicalName')) ?? undefined,
      domainId:
        typeof columnYMap.get('domainId') === 'number'
          ? Number(columnYMap.get('domainId'))
          : undefined,
    };
  }

  /**
   * 현재 스키마의 유효한 컬럼을 표시 순서대로 읽는다.
   * @param tableYMap 테이블
   * @returns 컬럼 엔티티 목록
   */
  private readColumns(tableYMap: Y.Map<unknown>): Array<{
    id: string;
    name: string;
    type?: string;
    pk?: boolean;
    logicalName?: string;
    domainId?: number;
  }> {
    const columns = readColumnYMaps(tableYMap);
    const result: Array<{
      id: string;
      name: string;
      type?: string;
      pk?: boolean;
      logicalName?: string;
      domainId?: number;
    }> = [];
    for (const column of columns) {
      if (!(column instanceof Y.Map)) {
        continue;
      }
      const id = readString(column.get('id'));
      const name = readString(column.get('name'));
      if (!id || !name) {
        continue;
      }
      result.push({
        id,
        name,
        type: readString(column.get('type')) ?? undefined,
        pk: column.get('pk') === true,
        logicalName: readString(column.get('logicalName')) ?? undefined,
        domainId:
          typeof column.get('domainId') === 'number' ? Number(column.get('domainId')) : undefined,
      });
    }
    return result;
  }

  private readTableNodeLike(
    tableId: string,
    tableYMap: Y.Map<unknown>,
  ): {
    id: string;
    position: { x: number; y: number };
    data: { handleLayout?: TableHandleLayout };
  } | null {
    const positionX = tableYMap.get('positionX');
    const positionY = tableYMap.get('positionY');
    if (typeof positionX !== 'number' || typeof positionY !== 'number') {
      return null;
    }
    const handleLayout = tableYMap.get('handleLayout');
    return {
      id: tableId,
      position: { x: positionX, y: positionY },
      data: {
        handleLayout:
          handleLayout === 'split' || handleLayout === 'left' || handleLayout === 'right'
            ? handleLayout
            : undefined,
      },
    };
  }

  /**
   * 존재하는 대상 컬럼의 변경된 FK 필드만 반영한다.
   * @param targetTableYMap 대상 테이블
   * @param targetColumnId 대상 컬럼 ID
   * @param relationType 관계 유형
   * @returns 없음
   */
  private applyTargetFkFlags(
    targetTableYMap: Y.Map<unknown>,
    targetColumnId: string,
    relationType: RelationType,
  ): void {
    patchColumnYMap(targetTableYMap, targetColumnId, {
      fk: true,
      ...(relationType === 'identifying' ? { pk: true, nullable: false } : {}),
    });
  }

  private resolveNormalizeOrigin(reason: 'edge' | 'table-move' | 'table-meta' | 'layout'): unknown {
    switch (reason) {
      case 'table-move':
        return DRAG_TRANSACTION_ORIGIN;
      case 'table-meta':
        return CANVAS_HISTORY_ORIGIN.USER_TABLE;
      case 'layout':
        return CANVAS_HISTORY_ORIGIN.USER_LAYOUT;
      case 'edge':
      default:
        return CANVAS_HISTORY_ORIGIN.USER_EDGE;
    }
  }
}
