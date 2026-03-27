export const ERD_DOCUMENT_PLUGIN_ID = 'erd';

import * as Y from 'yjs';
import type {
  ArtifactFallbackCapablePlugin,
  CanvasInputAdapter,
  CompatibilityArtifactCodec,
  CompatibilityArtifactSerializer,
  DocumentCommand,
  InputAdapters,
  MutationPolicy,
  PluginContext,
  ProjectionRefreshRequest,
  ProjectionBridge,
  Projector,
  ScopeResolver,
} from '@/collaboration/core/contracts/document-plugin';
import type {
  DocumentChangeEvent,
  DocumentMutation,
  MutationMeta,
  ScopeRef,
} from '@/collaboration/core/contracts/document-read-executor';
import { YJS_SHARED_DOCUMENT_ENGINE_ID } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { EdgeHandleSelectionValue } from '@/lib/edge-handles';
import type { DdlParseResult } from '@/lib/ddl-parser';
import type { DiagramDictionaryReconciliationPlan } from '@/lib/diagram-dictionary-reconciliation';
import type { DiffPlan } from '@/lib/erd-diff-plan';
import type { EdgeRoutingType, TableHeaderColor, Waypoint } from '@/types/erd';
import { buildErdColumnEntityId } from './erd-column-entity-id';
import { yDocToJson } from '@/collaboration/yjsBridge';

export const ERD_DOCUMENT_ENGINE_ID = YJS_SHARED_DOCUMENT_ENGINE_ID;

const ERD_PLUGIN_SCHEMA_VERSION = 1;
const ERD_COMPATIBILITY_ARTIFACT_VERSION = 1;

export type EdgeHandleNormalizationReason = 'edge' | 'table-move' | 'table-meta' | 'layout';

export interface ErdCanvasInputAdapter extends CanvasInputAdapter {
  addTable(name?: string): DocumentCommand;
  deleteTable(tableId: string): DocumentCommand;
  connectEdge(
    sourceTableId: string,
    targetTableId: string,
    sourceHandle: string,
    targetHandle: string,
    relationType: string,
  ): DocumentCommand;
  addFkRelation(parentTableId: string, childTableId: string, relationType: string): DocumentCommand;
  deleteEdge(edgeId: string, removeFkColumn?: boolean): DocumentCommand;
  updateEdgeRoutingType(edgeId: string, routingType: EdgeRoutingType): DocumentCommand;
  updateEdgeHandleSelection(edgeId: string, selection: EdgeHandleSelectionValue): DocumentCommand;
  updateEdgeWaypoints(edgeId: string, waypoints: Waypoint[]): DocumentCommand;
  resetEdgeWaypoints(edgeId: string): DocumentCommand;
  normalizeEdgeHandles(nodeIds?: string[], reason?: EdgeHandleNormalizationReason): DocumentCommand;
  moveTable(tableId: string, positionX: number, positionY: number): DocumentCommand;
  renameTable(tableId: string, label: string): DocumentCommand;
  updateTableMeta(tableId: string, updates: Record<string, unknown>): DocumentCommand;
  addColumn(tableId: string): DocumentCommand;
  deleteColumn(tableId: string, colId: string): DocumentCommand;
  moveColumn(tableId: string, fromIndex: number, toIndex: number): DocumentCommand;
  updateColumn(tableId: string, colId: string, updates: Record<string, unknown>): DocumentCommand;
  addGroup(label?: string): DocumentCommand;
  deleteGroup(groupId: string): DocumentCommand;
  renameGroup(groupId: string, label: string): DocumentCommand;
  updateGroupColor(groupId: string, color: TableHeaderColor | 'default'): DocumentCommand;
  updateGroupTables(groupId: string, toAdd: string[], toRemove: string[]): DocumentCommand;
  importDdl(result: DdlParseResult): DocumentCommand;
  replaceFromDdl(result: DdlParseResult): DocumentCommand;
  applyDiffPlan(plan: DiffPlan): DocumentCommand;
  reconcileDictionary(plan: DiagramDictionaryReconciliationPlan): DocumentCommand;
}

class ErdCanvasInputAdapterImpl implements ErdCanvasInputAdapter {
  readonly kind = 'canvas' as const;

  addTable(name?: string): DocumentCommand {
    return {
      key: 'table:add',
      payload: {
        name,
      },
    };
  }

  deleteTable(tableId: string): DocumentCommand {
    return {
      key: 'table:delete',
      payload: {
        tableId,
      },
    };
  }

  connectEdge(
    sourceTableId: string,
    targetTableId: string,
    sourceHandle: string,
    targetHandle: string,
    relationType: string,
  ): DocumentCommand {
    return {
      key: 'edge:connect',
      payload: {
        sourceTableId,
        targetTableId,
        sourceHandle,
        targetHandle,
        relationType,
      },
    };
  }

  addFkRelation(
    parentTableId: string,
    childTableId: string,
    relationType: string,
  ): DocumentCommand {
    return {
      key: 'edge:add-fk-relation',
      payload: {
        parentTableId,
        childTableId,
        relationType,
      },
    };
  }

  deleteEdge(edgeId: string, removeFkColumn = false): DocumentCommand {
    return {
      key: 'edge:delete',
      payload: {
        edgeId,
        removeFkColumn,
      },
    };
  }

  updateEdgeRoutingType(edgeId: string, routingType: EdgeRoutingType): DocumentCommand {
    return {
      key: 'edge:update-routing-type',
      payload: {
        edgeId,
        routingType,
      },
    };
  }

  updateEdgeHandleSelection(edgeId: string, selection: EdgeHandleSelectionValue): DocumentCommand {
    return {
      key: 'edge:update-handle-selection',
      payload: {
        edgeId,
        selection,
      },
    };
  }

  updateEdgeWaypoints(edgeId: string, waypoints: Waypoint[]): DocumentCommand {
    return {
      key: 'edge:update-waypoints',
      payload: {
        edgeId,
        waypoints,
      },
    };
  }

  resetEdgeWaypoints(edgeId: string): DocumentCommand {
    return {
      key: 'edge:reset-waypoints',
      payload: {
        edgeId,
      },
    };
  }

  normalizeEdgeHandles(
    nodeIds?: string[],
    reason: EdgeHandleNormalizationReason = 'edge',
  ): DocumentCommand {
    return {
      key: 'edge:normalize-handles',
      payload: {
        ...(Array.isArray(nodeIds) ? { nodeIds } : {}),
        reason,
      },
    };
  }

  moveTable(tableId: string, positionX: number, positionY: number): DocumentCommand {
    return {
      key: 'table:move',
      payload: {
        tableId,
        positionX,
        positionY,
      },
    };
  }

  renameTable(tableId: string, label: string): DocumentCommand {
    return {
      key: 'table:rename',
      payload: {
        tableId,
        label,
      },
    };
  }

  updateTableMeta(tableId: string, updates: Record<string, unknown>): DocumentCommand {
    return {
      key: 'table:update-meta',
      payload: {
        tableId,
        ...updates,
      },
    };
  }

  addColumn(tableId: string): DocumentCommand {
    return {
      key: 'column:add',
      payload: {
        tableId,
      },
    };
  }

  deleteColumn(tableId: string, colId: string): DocumentCommand {
    return {
      key: 'column:delete',
      payload: {
        tableId,
        colId,
      },
    };
  }

  moveColumn(tableId: string, fromIndex: number, toIndex: number): DocumentCommand {
    return {
      key: 'column:move',
      payload: {
        tableId,
        fromIndex,
        toIndex,
      },
    };
  }

  updateColumn(tableId: string, colId: string, updates: Record<string, unknown>): DocumentCommand {
    return {
      key: 'column:update',
      payload: {
        tableId,
        colId,
        ...updates,
      },
    };
  }

  addGroup(label?: string): DocumentCommand {
    return {
      key: 'group:add',
      payload: {
        label,
      },
    };
  }

  deleteGroup(groupId: string): DocumentCommand {
    return {
      key: 'group:delete',
      payload: {
        groupId,
      },
    };
  }

  renameGroup(groupId: string, label: string): DocumentCommand {
    return {
      key: 'group:rename',
      payload: {
        groupId,
        label,
      },
    };
  }

  updateGroupColor(groupId: string, color: TableHeaderColor | 'default'): DocumentCommand {
    return {
      key: 'group:update-color',
      payload: {
        groupId,
        color,
      },
    };
  }

  updateGroupTables(groupId: string, toAdd: string[], toRemove: string[]): DocumentCommand {
    return {
      key: 'group:update-tables',
      payload: {
        groupId,
        toAdd,
        toRemove,
      },
    };
  }

  importDdl(result: DdlParseResult): DocumentCommand {
    return {
      key: 'ddl:import',
      payload: {
        result,
      },
    };
  }

  replaceFromDdl(result: DdlParseResult): DocumentCommand {
    return {
      key: 'ddl:replace',
      payload: {
        result,
      },
    };
  }

  applyDiffPlan(plan: DiffPlan): DocumentCommand {
    return {
      key: 'diff:apply-plan',
      payload: {
        plan,
      },
    };
  }

  reconcileDictionary(plan: DiagramDictionaryReconciliationPlan): DocumentCommand {
    return {
      key: 'dictionary:reconcile',
      payload: {
        plan,
      },
    };
  }
}

export function isErdCanvasInputAdapter(
  adapter: CanvasInputAdapter | undefined,
): adapter is ErdCanvasInputAdapter {
  return (
    !!adapter &&
    typeof (adapter as ErdCanvasInputAdapter).addTable === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).deleteTable === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).connectEdge === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).addFkRelation === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).deleteEdge === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateEdgeRoutingType === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateEdgeHandleSelection === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateEdgeWaypoints === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).resetEdgeWaypoints === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).normalizeEdgeHandles === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).moveTable === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).renameTable === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateTableMeta === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).addColumn === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).deleteColumn === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).moveColumn === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateColumn === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).addGroup === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).deleteGroup === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).renameGroup === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateGroupColor === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).updateGroupTables === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).importDdl === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).replaceFromDdl === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).applyDiffPlan === 'function' &&
    typeof (adapter as ErdCanvasInputAdapter).reconcileDictionary === 'function'
  );
}

class ErdProjector implements Projector {
  constructor(private readonly projectionBridge?: ProjectionBridge) {}

  project(_read: PluginContext['read'], event?: DocumentChangeEvent): void {
    if (!event || !this.projectionBridge) {
      return;
    }
    if (event.engineOrigin.source === 'remote' || event.engineOrigin.source === 'system') {
      this.projectionBridge.refreshPersistedView(this.buildRefreshRequest(_read, event));
    }
  }

  private buildRefreshRequest(
    _read: PluginContext['read'],
    event: DocumentChangeEvent,
  ): ProjectionRefreshRequest {
    if (event.engineOrigin.source === 'system' || event.affectedScopes.length === 0) {
      return { forceFull: true };
    }
    return { scopeHints: event.affectedScopes };
  }
}

class ErdScopeResolver implements ScopeResolver {
  resolve(command: DocumentCommand): ScopeRef[] {
    const tableId = this.readString(command.payload?.tableId);
    const colId = this.readString(command.payload?.colId);
    const groupId = this.readString(command.payload?.groupId);

    if (command.key.startsWith('table:') && tableId) {
      return [{ kind: 'table', id: tableId, mode: 'exclusive' }];
    }
    if (command.key === 'table:add') {
      return [];
    }
    if (command.key.startsWith('column:') && tableId && colId) {
      return [
        { kind: 'table', id: tableId, mode: 'shared' },
        { kind: 'column', id: buildErdColumnEntityId(tableId, colId), mode: 'exclusive' },
      ];
    }
    if ((command.key === 'column:add' || command.key === 'column:move') && tableId) {
      return [{ kind: 'table', id: tableId, mode: 'exclusive' }];
    }
    if (command.key === 'edge:connect') {
      const sourceTableId = this.readString(command.payload?.sourceTableId);
      const targetTableId = this.readString(command.payload?.targetTableId);
      return [
        ...(sourceTableId
          ? [{ kind: 'table' as const, id: sourceTableId, mode: 'shared' as const }]
          : []),
        ...(targetTableId
          ? [{ kind: 'table' as const, id: targetTableId, mode: 'shared' as const }]
          : []),
      ];
    }
    if (command.key === 'edge:add-fk-relation') {
      const parentTableId = this.readString(command.payload?.parentTableId);
      const childTableId = this.readString(command.payload?.childTableId);
      return [
        ...(parentTableId
          ? [{ kind: 'table' as const, id: parentTableId, mode: 'shared' as const }]
          : []),
        ...(childTableId
          ? [{ kind: 'table' as const, id: childTableId, mode: 'exclusive' as const }]
          : []),
      ];
    }
    if (command.key === 'edge:delete') {
      const edgeId = this.readString(command.payload?.edgeId);
      return edgeId ? [{ kind: 'edge', id: edgeId, mode: 'exclusive' }] : [];
    }
    if (command.key === 'edge:normalize-handles' && Array.isArray(command.payload?.nodeIds)) {
      return command.payload.nodeIds
        .filter((nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.length > 0)
        .map((nodeId) => ({ kind: 'table' as const, id: nodeId, mode: 'shared' as const }));
    }
    if (
      command.key === 'edge:update-routing-type' ||
      command.key === 'edge:update-handle-selection' ||
      command.key === 'edge:update-waypoints' ||
      command.key === 'edge:reset-waypoints'
    ) {
      const edgeId = this.readString(command.payload?.edgeId);
      return edgeId ? [{ kind: 'edge', id: edgeId, mode: 'exclusive' }] : [];
    }
    if (command.key.startsWith('group:') && groupId) {
      return [{ kind: 'group', id: groupId, mode: 'exclusive' }];
    }
    if (command.key === 'dictionary:reconcile') {
      const plan = command.payload?.plan as DiagramDictionaryReconciliationPlan | undefined;
      if (!plan) {
        return [];
      }

      const scopes: ScopeRef[] = [];
      for (const tableUpdate of plan.tableMetaUpdates) {
        scopes.push({ kind: 'table', id: tableUpdate.nodeId, mode: 'shared' });
      }
      for (const columnUpdate of plan.columnUpdates) {
        scopes.push({ kind: 'table', id: columnUpdate.nodeId, mode: 'shared' });
        scopes.push({
          kind: 'column',
          id: buildErdColumnEntityId(columnUpdate.nodeId, columnUpdate.colId),
          mode: 'shared',
        });
      }
      return scopes;
    }
    return [];
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}

class ErdMutationPolicy implements MutationPolicy {
  constructor(private readonly scopeResolver: ScopeResolver) {}

  toMutation(command: DocumentCommand, _meta: MutationMeta): DocumentMutation {
    return {
      key: command.key,
      payload: command.payload,
      affectedScopes: this.scopeResolver.resolve(command),
    };
  }
}

class ErdCompatibilityArtifactSerializer implements CompatibilityArtifactSerializer {
  readonly artifactVersion = ERD_COMPATIBILITY_ARTIFACT_VERSION;

  build(snapshot: Uint8Array): Uint8Array | null {
    if (snapshot.length === 0) {
      return null;
    }

    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot);
    return new TextEncoder().encode(yDocToJson(doc));
  }
}

/**
 * ERD 문서 타입의 Phase 1 최소 플러그인 구현.
 *
 * 입력/변이/스코프 해석 계약만 먼저 concrete class로 고정하고,
 * 실제 projector와 text pipeline 치환은 다음 단계에서 진행한다.
 */
export class ErdDocumentPlugin implements ArtifactFallbackCapablePlugin {
  readonly pluginId = ERD_DOCUMENT_PLUGIN_ID;
  readonly schemaVersion = ERD_PLUGIN_SCHEMA_VERSION;
  readonly supportedEngineIds = [ERD_DOCUMENT_ENGINE_ID];

  createInputAdapters(_context: PluginContext): InputAdapters {
    return {
      canvas: new ErdCanvasInputAdapterImpl(),
    };
  }

  createMutationPolicy(_context: PluginContext): MutationPolicy {
    return new ErdMutationPolicy(this.createScopeResolver(_context));
  }

  createProjectors(_context: PluginContext): Projector[] {
    return [new ErdProjector(_context.projectionBridge)];
  }

  createScopeResolver(_context: PluginContext): ScopeResolver {
    return new ErdScopeResolver();
  }

  createArtifactSerializer(_context: PluginContext): CompatibilityArtifactSerializer {
    return new ErdCompatibilityArtifactSerializer();
  }

  createArtifactCodec(_context: PluginContext): CompatibilityArtifactCodec {
    throw new Error('ERD compatibility artifact restore is not used in Phase 1');
  }
}

export function createErdDocumentPlugin(): ErdDocumentPlugin {
  return new ErdDocumentPlugin();
}
