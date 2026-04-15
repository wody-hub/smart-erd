import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import {
  createEdgeYMap,
  createTableYMap,
  getEdgesMap,
  getTablesMap,
  migrateJsonToYDoc,
  setTableYMapPosition,
  syncLegacyWaypointsInEdgeYMap,
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
    'unit-test',
  );

  const [edge] = yEdgesMapToEdges(getEdgesMap(doc));
  assert.equal(edge?.data?.relationType, 'identifying');
  assert.equal(edge?.data?.routingType, 'straight');
  assert.equal(edge?.data?.handleMode, 'manual');
  assert.equal(edge?.data?.sourceSide, 'left');
  assert.equal(edge?.data?.targetSide, 'right');
  assert.deepEqual(edge?.data?.waypoints, [{ x: 180, y: 220 }]);
});

test('syncLegacyWaypointsInEdgeYMap 는 attached edge 에 legacy Y.Array waypoint 표현을 유지한다', () => {
  const doc = new Y.Doc();
  const edgesMap = getEdgesMap(doc);

  doc.transact(() => {
    const edgeYMap = createEdgeYMap(
      'table-a',
      'table-b',
      'table-a-col-a-source-right',
      'table-b-col-b-target-left',
      'non-identifying',
      'straight',
      [{ x: 120, y: 140 }],
    );
    edgesMap.set('edge-1', edgeYMap);
    syncLegacyWaypointsInEdgeYMap(edgeYMap);
  });

  const edgeYMap = edgesMap.get('edge-1');
  assert.ok(edgeYMap, 'edge-1 should exist');
  assert.ok(
    edgeYMap?.get('waypoints') instanceof Y.Array,
    'attached edge should keep legacy Y.Array waypoints',
  );
  assert.deepEqual(yEdgesMapToEdges(edgesMap)[0]?.data?.waypoints, [{ x: 120, y: 140 }]);
});

test('setTableYMapPosition 는 attached table 에 legacy nested position map 도 유지한다', () => {
  const doc = new Y.Doc();
  const tablesMap = getTablesMap(doc);

  doc.transact(() => {
    const tableYMap = createTableYMap('table_a', { x: 100, y: 100 }, []);
    tablesMap.set('table-a', tableYMap);
    setTableYMapPosition(tableYMap, { x: 220, y: 330 });
  });

  const tableYMap = tablesMap.get('table-a');
  assert.equal(tableYMap?.get('positionX'), 220);
  assert.equal(tableYMap?.get('positionY'), 330);

  const legacyPosition = tableYMap?.get('position');
  assert.ok(legacyPosition instanceof Y.Map, 'attached table should keep legacy position Y.Map');
  assert.equal(legacyPosition?.get('x'), 220);
  assert.equal(legacyPosition?.get('y'), 330);
});
