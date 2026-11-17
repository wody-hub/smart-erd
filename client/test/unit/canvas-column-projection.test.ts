import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import useCanvasStore from '../../src/stores/erd/useCanvasStore.js';
import {
  createEdgeYMap,
  createTableYMap,
  getEdgesMap,
  getTablesMap,
  setTableYMapPosition,
} from '../../src/collaboration/yjsBridge.js';
import { adoptUserNodes, type NodeLookup, type ParentLookup } from '@xyflow/system';
import type { Node } from '@xyflow/react';
import type { TableNodeData } from '../../src/types/erd.js';
import { patchColumnYMap } from '../../src/collaboration/yjs-columns.js';

/**
 * 측정된 테이블이 있는 실제 Y.Doc/store 경계에서 projection을 검증한다.
 * @param check 검증 콜백
 * @returns 없음
 */
function withMeasuredTable(check: (doc: Y.Doc, previous: Node<TableNodeData>) => void): void {
  useCanvasStore.getState().destroyYDoc();
  const doc = new Y.Doc();
  getTablesMap(doc).set(
    'table',
    createTableYMap('Table', { x: 0, y: 0 }, [
      { id: 'a', name: 'id', type: 'BIGINT' },
      { id: 'b', name: 'name', type: 'TEXT' },
    ]),
  );
  try {
    useCanvasStore.getState().initYDoc(doc);
    const previous = {
      ...useCanvasStore.getState().nodes[0],
      measured: { width: 460, height: 180 },
      width: 460,
      height: 180,
      initialWidth: 460,
      initialHeight: 180,
      selected: true,
      dragging: false,
      resizing: false,
    };
    useCanvasStore.getState().setNodes([previous]);
    check(doc, previous);
  } finally {
    useCanvasStore.getState().destroyYDoc();
  }
}

test('column rename retains local fields and React Flow handle bounds without writing them to Y.Doc', () => {
  withMeasuredTable((doc, previous) => {
    const lookup: NodeLookup = new Map();
    const parents: ParentLookup = new Map();
    adoptUserNodes([previous], lookup, parents);
    const handleBounds = { source: [], target: [] };
    lookup.get('table')!.internals.handleBounds = handleBounds;

    useCanvasStore.getState().updateColumn('table', 'a', { name: 'renamed' });

    const next = useCanvasStore.getState().nodes[0];
    assert.equal(next.data.columns[0].name, 'renamed');
    assert.equal(next.measured, previous.measured);
    assert.equal(next.width, 460);
    assert.equal(next.height, 180);
    assert.equal(next.initialWidth, 460);
    assert.equal(next.initialHeight, 180);
    assert.equal(next.selected, true);
    assert.equal(next.dragging, false);
    assert.equal(next.resizing, false);
    adoptUserNodes([next], lookup, parents);
    assert.equal(lookup.get('table')!.internals.handleBounds, handleBounds);
    assert.deepEqual(lookup.get('table')!.measured, { width: 460, height: 180 });
    const table = getTablesMap(doc).get('table')!;
    for (const key of ['measured', 'width', 'height', 'selected', 'dragging', 'resizing']) {
      assert.equal(table.has(key), false);
    }
  });
});

test('whole nodes target retains local fields while forceFull and unscoped projection reset them', () => {
  withMeasuredTable((_doc, previous) => {
    useCanvasStore.getState().syncFromYDoc({ targets: ['nodes'] });
    assert.equal(useCanvasStore.getState().nodes[0].measured, previous.measured);
    assert.equal(useCanvasStore.getState().nodes[0].selected, true);
    useCanvasStore.getState().syncFromYDoc({ forceFull: true });
    assert.equal(useCanvasStore.getState().nodes[0].measured, undefined);
    assert.equal(useCanvasStore.getState().nodes[0].selected, undefined);
    useCanvasStore.getState().setNodes([previous]);
    useCanvasStore.getState().syncFromYDoc();
    assert.equal(useCanvasStore.getState().nodes[0].measured, undefined);
    assert.equal(useCanvasStore.getState().nodes[0].selected, undefined);
  });
});

for (const operation of ['add', 'delete', 'reorder', 'layout'] as const) {
  test(`column structure ${operation} invalidates dimensions but retains selection`, () => {
    withMeasuredTable((doc, previous) => {
      if (operation === 'add') useCanvasStore.getState().addColumn('table');
      if (operation === 'delete') useCanvasStore.getState().deleteColumn('table', 'a');
      if (operation === 'reorder') useCanvasStore.getState().moveColumn('table', 0, 1);
      if (operation === 'layout') getTablesMap(doc).get('table')!.set('handleLayout', 'left');
      const next = useCanvasStore.getState().nodes[0];
      assert.notEqual(next.data, previous.data);
      assert.equal(next.selected, true);
      for (const key of ['measured', 'width', 'height', 'initialWidth', 'initialHeight'] as const) {
        assert.equal(next[key], undefined);
      }
      const lookup: NodeLookup = new Map();
      const parents: ParentLookup = new Map();
      adoptUserNodes([previous], lookup, parents);
      lookup.get('table')!.internals.handleBounds = { source: [], target: [] };
      adoptUserNodes([next], lookup, parents);
      assert.equal(lookup.get('table')!.internals.handleBounds, undefined);
    });
  });
}

test('position projection retains dimensions and clears obsolete dragging state', () => {
  withMeasuredTable((doc, previous) => {
    useCanvasStore.getState().setNodes([{ ...previous, dragging: true }]);
    setTableYMapPosition(getTablesMap(doc).get('table')!, { x: 500, y: 200 });
    const next = useCanvasStore.getState().nodes[0];
    assert.deepEqual(next.position, { x: 500, y: 200 });
    assert.equal(next.measured, previous.measured);
    assert.equal(next.selected, true);
    assert.equal(next.dragging, false);
  });
});

test('projector-managed remote update retains local fields when explicitly projected', () => {
  withMeasuredTable((doc, previous) => {
    const remote = new Y.Doc();
    try {
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
      patchColumnYMap(getTablesMap(remote).get('table')!, 'a', { name: 'remote_name' });
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), 'remote');
      assert.equal(useCanvasStore.getState().nodes[0], previous);
      useCanvasStore.getState().syncFromYDoc({ targets: ['nodes'], nodeIds: ['table'] });
      const next = useCanvasStore.getState().nodes[0];
      assert.equal(next.data.columns[0].name, 'remote_name');
      assert.equal(next.measured, previous.measured);
      assert.equal(next.selected, true);
    } finally {
      remote.destroy();
    }
  });
});

test('deferred rename during drag preserves the completed drag state and dimensions', () => {
  withMeasuredTable((doc, previous) => {
    useCanvasStore
      .getState()
      .onNodesChange([
        { id: 'table', type: 'position', position: { x: 50, y: 25 }, dragging: true },
      ]);
    useCanvasStore.getState().updateColumn('table', 'a', { name: 'during_drag' });
    assert.equal(useCanvasStore.getState().nodes[0].data.columns[0].name, 'id');
    useCanvasStore
      .getState()
      .onNodesChange([
        { id: 'table', type: 'position', position: { x: 50, y: 25 }, dragging: false },
      ]);
    const applier = new ErdDocumentMutationApplier(new YjsSharedDocumentEngine(doc));
    assert.equal(
      applier.apply({
        key: 'table:move',
        payload: { tableId: 'table', positionX: 50, positionY: 25 },
        affectedScopes: [],
      }).applied,
      true,
    );
    useCanvasStore.getState().finalizeNodeDrag();
    const next = useCanvasStore.getState().nodes[0];
    assert.equal(next.data.columns[0].name, 'during_drag');
    assert.deepEqual(next.position, { x: 50, y: 25 });
    assert.equal(next.dragging, false);
    assert.equal(next.measured, previous.measured);
    assert.equal(next.selected, true);
  });
});

test('dimension changes after structural invalidation become the measurements retained by later renames', () => {
  withMeasuredTable(() => {
    useCanvasStore.getState().addColumn('table');
    useCanvasStore
      .getState()
      .onNodesChange([
        { id: 'table', type: 'dimensions', dimensions: { width: 470, height: 215 } },
      ]);
    const measured = useCanvasStore.getState().nodes[0].measured;
    useCanvasStore.getState().updateColumn('table', 'a', { name: 'after_measurement' });
    assert.equal(useCanvasStore.getState().nodes[0].measured, measured);
    assert.deepEqual(measured, { width: 470, height: 215 });
  });
});

for (const combined of [false, true]) {
  test(`same ID recreation resets local fields (${combined ? 'one transaction' : 'separate transactions'})`, () => {
    withMeasuredTable((doc, previous) => {
      const tables = getTablesMap(doc);
      const recreate = () =>
        tables.set('table', createTableYMap('Recreated', { x: 0, y: 0 }, previous.data.columns));
      if (combined) {
        doc.transact(() => {
          tables.delete('table');
          recreate();
        });
      } else {
        tables.delete('table');
        recreate();
      }
      const next = useCanvasStore.getState().nodes[0];
      assert.equal(next.data.label, 'Recreated');
      assert.equal(next.measured, undefined);
      assert.equal(next.selected, undefined);
    });
  });
}

test('type change does not retain local fields', () => {
  withMeasuredTable((_doc, previous) => {
    useCanvasStore.getState().setNodes([{ ...previous, type: 'other' }]);
    useCanvasStore.getState().syncFromYDoc({ nodeIds: ['table'] });
    const next = useCanvasStore.getState().nodes[0];
    assert.equal(next.type, 'table');
    assert.equal(next.measured, undefined);
    assert.equal(next.selected, undefined);
  });
});

test('document replacement does not reuse local fields for identical IDs', () => {
  withMeasuredTable((_doc, previous) => {
    const replacement = new Y.Doc();
    getTablesMap(replacement).set(
      'table',
      createTableYMap('Other', { x: 0, y: 0 }, previous.data.columns),
    );
    useCanvasStore.getState().destroyYDoc();
    try {
      useCanvasStore.getState().initYDoc(replacement);
      assert.equal(useCanvasStore.getState().nodes[0].measured, undefined);
      assert.equal(useCanvasStore.getState().nodes[0].selected, undefined);
    } finally {
      useCanvasStore.getState().destroyYDoc();
    }
  });
});

test('single column rename preserves all other node references and the edges array', () => {
  const doc = new Y.Doc();
  useCanvasStore.getState().destroyYDoc();

  try {
    doc.transact(() => {
      const tables = getTablesMap(doc);
      for (let index = 0; index < 200; index += 1) {
        tables.set(
          `table-${index}`,
          createTableYMap(`Table ${index}`, { x: index * 500, y: 0 }, [
            { id: `column-${index}`, name: 'id', type: 'BIGINT', pk: true, nullable: false },
          ]),
        );
      }
      getEdgesMap(doc).set(
        'edge-1',
        createEdgeYMap(
          'table-0',
          'table-1',
          'table-0-column-0-source-right',
          'table-1-column-1-target-left',
        ),
      );
    });

    useCanvasStore.getState().initYDoc(doc);
    const previousNodes = useCanvasStore.getState().nodes;
    const previousEdges = useCanvasStore.getState().edges;

    useCanvasStore.getState().updateColumn('table-87', 'column-87', { name: 'renamed_id' });

    const { nodes, edges } = useCanvasStore.getState();
    assert.equal(nodes.length, 200);
    assert.equal(nodes[87]?.data.columns[0]?.name, 'renamed_id');
    assert.equal(edges, previousEdges);
    for (let index = 0; index < nodes.length; index += 1) {
      if (index !== 87) assert.equal(nodes[index], previousNodes[index]);
    }
  } finally {
    useCanvasStore.getState().destroyYDoc();
    doc.destroy();
  }
});
