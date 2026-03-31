import * as Y from 'yjs';
import type {
  DocumentEntity,
  DocumentEntityRef,
  DocumentReadContext,
  DocumentReadContextFactory,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DocumentRevisionSource } from '@/collaboration/core/store/document-revision-tracker';
import {
  getEdgesMap,
  getGroupsMap,
  getTablesMap,
  readWaypointsFromEdgeYMap,
} from '@/collaboration/yjsBridge';
import {
  buildErdColumnEntityId,
  parseErdColumnEntityId,
} from '@/collaboration/plugins/erd/erd-column-entity-id';

export class ErdDocumentReadContextFactory implements DocumentReadContextFactory {
  constructor(
    private readonly engine: YjsSharedDocumentEngine,
    private readonly revisionSource: DocumentRevisionSource,
  ) {}

  create(): DocumentReadContext {
    return new ErdDocumentReadContext(this.engine.getDocument(), this.revisionSource);
  }
}

class ErdDocumentReadContext implements DocumentReadContext {
  constructor(
    private readonly doc: Y.Doc,
    private readonly revisionSource: DocumentRevisionSource,
  ) {}

  getEntity(ref: DocumentEntityRef): DocumentEntity | null {
    switch (ref.kind) {
      case 'table':
        return this.readTableEntity(ref.id);
      case 'edge':
        return this.readEdgeEntity(ref.id);
      case 'group':
        return this.readGroupEntity(ref.id);
      case 'column':
        return this.readColumnEntity(ref.id);
      default:
        return null;
    }
  }

  listRelated(ref: DocumentEntityRef, relation: string): DocumentEntityRef[] {
    if (ref.kind === 'table' && relation === 'columns') {
      const tableYMap = getTablesMap(this.doc).get(ref.id);
      if (!tableYMap) {
        return [];
      }
      const columnsYArray = tableYMap.get('columns');
      if (!(columnsYArray instanceof Y.Array)) {
        return [];
      }
      return columnsYArray
        .toArray()
        .filter((columnYMap): columnYMap is Y.Map<unknown> => columnYMap instanceof Y.Map)
        .map((columnYMap) => columnYMap.get('id'))
        .filter(
          (columnId): columnId is string => typeof columnId === 'string' && columnId.length > 0,
        )
        .map((columnId) => ({ kind: 'column', id: buildErdColumnEntityId(ref.id, columnId) }));
    }

    if (ref.kind === 'group' && relation === 'tables') {
      const groupYMap = getGroupsMap(this.doc).get(ref.id);
      if (!groupYMap) {
        return [];
      }
      const tableIds = groupYMap.get('tableIds');
      if (!(tableIds instanceof Y.Array)) {
        return [];
      }
      return tableIds
        .toArray()
        .filter((tableId): tableId is string => typeof tableId === 'string' && tableId.length > 0)
        .map((tableId) => ({ kind: 'table', id: tableId }));
    }

    if (ref.kind === 'table' && relation === 'edges') {
      const result: DocumentEntityRef[] = [];
      getEdgesMap(this.doc).forEach((edgeYMap, edgeId) => {
        if (edgeYMap.get('source') === ref.id || edgeYMap.get('target') === ref.id) {
          result.push({ kind: 'edge', id: edgeId });
        }
      });
      return result;
    }

    return [];
  }

  getProperty(ref: DocumentEntityRef, key: string): unknown {
    return this.getEntity(ref)?.props[key];
  }

  findByKind(kind: string): DocumentEntityRef[] {
    if (kind === 'table') {
      return Array.from(getTablesMap(this.doc).keys()).map((id) => ({ kind: 'table', id }));
    }
    if (kind === 'edge') {
      return Array.from(getEdgesMap(this.doc).keys()).map((id) => ({ kind: 'edge', id }));
    }
    if (kind === 'group') {
      return Array.from(getGroupsMap(this.doc).keys()).map((id) => ({ kind: 'group', id }));
    }
    if (kind === 'column') {
      const result: DocumentEntityRef[] = [];
      getTablesMap(this.doc).forEach((tableYMap, tableId) => {
        const columnsYArray = tableYMap.get('columns');
        if (!(columnsYArray instanceof Y.Array)) {
          return;
        }
        columnsYArray.forEach((columnYMap) => {
          if (!(columnYMap instanceof Y.Map)) {
            return;
          }
          const columnId = columnYMap.get('id');
          if (typeof columnId === 'string' && columnId.length > 0) {
            result.push({
              kind: 'column',
              id: buildErdColumnEntityId(tableId, columnId),
            });
          }
        });
      });
      return result;
    }
    return [];
  }

  getRevision(): string {
    return this.revisionSource.getRevision();
  }

  private readTableEntity(tableId: string): DocumentEntity | null {
    const tableYMap = getTablesMap(this.doc).get(tableId);
    if (!tableYMap) {
      return null;
    }
    return {
      ref: { kind: 'table', id: tableId },
      props: {
        id: tableId,
        label: tableYMap.get('label'),
        logicalTableName: tableYMap.get('logicalTableName'),
        tableTermId: tableYMap.get('tableTermId'),
        headerColor: tableYMap.get('headerColor'),
        handleLayout: tableYMap.get('handleLayout'),
        positionX: tableYMap.get('positionX'),
        positionY: tableYMap.get('positionY'),
      },
    };
  }

  private readEdgeEntity(edgeId: string): DocumentEntity | null {
    const edgeYMap = getEdgesMap(this.doc).get(edgeId);
    if (!edgeYMap) {
      return null;
    }
    return {
      ref: { kind: 'edge', id: edgeId },
      props: {
        id: edgeId,
        source: edgeYMap.get('source'),
        target: edgeYMap.get('target'),
        sourceHandle: edgeYMap.get('sourceHandle'),
        targetHandle: edgeYMap.get('targetHandle'),
        relationType: edgeYMap.get('relationType'),
        routingType: edgeYMap.get('routingType'),
        handleMode: edgeYMap.get('handleMode'),
        sourceSide: edgeYMap.get('sourceSide'),
        targetSide: edgeYMap.get('targetSide'),
        waypoints: readWaypointsFromEdgeYMap(edgeYMap),
      },
    };
  }

  private readGroupEntity(groupId: string): DocumentEntity | null {
    const groupYMap = getGroupsMap(this.doc).get(groupId);
    if (!groupYMap) {
      return null;
    }
    const tableIds = groupYMap.get('tableIds');
    return {
      ref: { kind: 'group', id: groupId },
      props: {
        id: groupId,
        label: groupYMap.get('label'),
        color: groupYMap.get('color'),
        tableIds:
          tableIds instanceof Y.Array
            ? tableIds.toArray().filter((tableId): tableId is string => typeof tableId === 'string')
            : [],
      },
    };
  }

  private readColumnEntity(columnEntityId: string): DocumentEntity | null {
    const parsedColumnRef = parseErdColumnEntityId(columnEntityId);
    if (!parsedColumnRef) {
      return null;
    }
    const tableYMap = getTablesMap(this.doc).get(parsedColumnRef.tableId);
    if (!tableYMap) {
      return null;
    }
    const columnsYArray = tableYMap.get('columns');
    if (!(columnsYArray instanceof Y.Array)) {
      return null;
    }
    const columnYMap = columnsYArray
      .toArray()
      .find(
        (candidate): candidate is Y.Map<unknown> =>
          candidate instanceof Y.Map && candidate.get('id') === parsedColumnRef.columnId,
      );
    if (!columnYMap) {
      return null;
    }
    return {
      ref: { kind: 'column', id: columnEntityId },
      props: {
        id: parsedColumnRef.columnId,
        tableId: parsedColumnRef.tableId,
        name: columnYMap.get('name'),
        type: columnYMap.get('type'),
        pk: columnYMap.get('pk'),
        fk: columnYMap.get('fk'),
        nullable: columnYMap.get('nullable'),
        autoIncrement: columnYMap.get('autoIncrement'),
        logicalName: columnYMap.get('logicalName'),
        termId: columnYMap.get('termId'),
        domainId: columnYMap.get('domainId'),
      },
    };
  }
}
