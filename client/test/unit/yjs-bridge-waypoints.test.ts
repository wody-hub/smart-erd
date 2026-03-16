import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import {
  createEdgeYMap,
  getEdgesMap,
  migrateJsonToYDoc,
  yEdgesMapToEdges,
} from '../../src/collaboration/yjsBridge.js';

test('yEdgesMapToEdges 는 edge waypoints 를 round-trip 한다', () => {
  const doc = new Y.Doc();
  const edgesMap = getEdgesMap(doc);

  doc.transact(() => {
    edgesMap.set(
      'edge-1',
      createEdgeYMap(
        'table-a',
        'table-b',
        'table-a-col-a-source-right',
        'table-b-col-b-target-left',
        'non-identifying',
        'straight',
        [
          { x: 120, y: 140 },
          { x: 240, y: 260 },
        ],
        'manual',
        'right',
        'left',
      ),
    );
  });

  const [edge] = yEdgesMapToEdges(edgesMap);
  assert.equal(edge?.data?.routingType, 'straight');
  assert.equal(edge?.data?.handleMode, 'manual');
  assert.equal(edge?.data?.sourceSide, 'right');
  assert.equal(edge?.data?.targetSide, 'left');
  assert.deepEqual(edge?.data?.waypoints, [
    { x: 120, y: 140 },
    { x: 240, y: 260 },
  ]);
});

test('migrateJsonToYDoc 는 relationType, routingType, waypoints 를 함께 보존한다', () => {
  const doc = new Y.Doc();

  migrateJsonToYDoc(
    doc,
    JSON.stringify({
      nodes: [
        {
          id: 'table-a',
          type: 'table',
          position: { x: 100, y: 100 },
          data: { label: 'table_a', columns: [] },
        },
        {
          id: 'table-b',
          type: 'table',
          position: { x: 400, y: 100 },
          data: { label: 'table_b', columns: [] },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'table-a',
          target: 'table-b',
          sourceHandle: 'table-a-col-a-source-left',
          targetHandle: 'table-b-col-b-target-right',
          data: {
            relationType: 'identifying',
            routingType: 'straight',
            handleMode: 'manual',
            sourceSide: 'left',
            targetSide: 'right',
            waypoints: [{ x: 180, y: 220 }],
          },
        },
      ],
      groups: [],
    }),
  );

  const [edge] = yEdgesMapToEdges(getEdgesMap(doc));
  assert.equal(edge?.data?.relationType, 'identifying');
  assert.equal(edge?.data?.routingType, 'straight');
  assert.equal(edge?.data?.handleMode, 'manual');
  assert.equal(edge?.data?.sourceSide, 'left');
  assert.equal(edge?.data?.targetSide, 'right');
  assert.deepEqual(edge?.data?.waypoints, [{ x: 180, y: 220 }]);
});
