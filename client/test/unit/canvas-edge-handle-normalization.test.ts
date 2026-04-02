import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import useCanvasStore from '../../src/stores/useCanvasStore.js';
import {
  createEdgeYMap,
  createTableYMap,
  getEdgesMap,
  getTablesMap,
} from '../../src/collaboration/yjsBridge.js';
import { buildColumnHandleId } from '../../src/lib/handle-id.js';

function resetCanvasStore() {
  useCanvasStore.getState().destroyYDoc();
}

function seedLegacyRelation(doc: Y.Doc) {
  doc.transact(() => {
    const tablesMap = getTablesMap(doc);
    tablesMap.set(
      'table-a',
      createTableYMap(
        'parent',
        { x: 100, y: 100 },
        [{ id: 'col-a', name: 'id', type: 'bigint', nullable: false }],
        { handleLayout: 'split' },
      ),
    );
    tablesMap.set(
      'table-b',
      createTableYMap(
        'child',
        { x: 760, y: 160 },
        [{ id: 'col-b', name: 'parent_id', type: 'bigint', nullable: false }],
        { handleLayout: 'split' },
      ),
    );
    getEdgesMap(doc).set(
      'edge-1',
      createEdgeYMap('table-a', 'table-b', 'table-a-col-a-source', 'table-b-col-b-target'),
    );
  });
}

test('initYDoc 는 legacy edge handle 을 side-aware 형식으로 정규화한다', () => {
  resetCanvasStore();
  const doc = new Y.Doc();

  try {
    seedLegacyRelation(doc);

    useCanvasStore.getState().initYDoc(doc);

    const [edge] = useCanvasStore.getState().edges;
    const sourceHandle = buildColumnHandleId('table-a', 'col-a', 'source', 'right');
    const targetHandle = buildColumnHandleId('table-b', 'col-b', 'target', 'left');

    assert.equal(edge?.sourceHandle, sourceHandle);
    assert.equal(edge?.targetHandle, targetHandle);
    assert.equal(getEdgesMap(doc).get('edge-1')?.get('sourceHandle'), sourceHandle);
    assert.equal(getEdgesMap(doc).get('edge-1')?.get('targetHandle'), targetHandle);
  } finally {
    resetCanvasStore();
  }
});
