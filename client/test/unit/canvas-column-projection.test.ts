import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import useCanvasStore from '../../src/stores/erd/useCanvasStore.js';
import {
  createEdgeYMap,
  createTableYMap,
  getEdgesMap,
  getTablesMap,
} from '../../src/collaboration/yjsBridge.js';

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
