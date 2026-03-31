import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolvePreservedWaypoints } from '../../src/lib/edge-presentation-restore.js';

test('resolvePreservedWaypoints 는 straight + 동일 handle 조합일 때만 waypoint 를 유지한다', () => {
  const waypoints = [
    { x: 560, y: 120 },
    { x: 560, y: 280 },
  ];

  assert.deepEqual(
    resolvePreservedWaypoints({
      routingType: 'straight',
      previousSourceHandle: 'table-a-col-id-source-right',
      previousTargetHandle: 'table-b-col-parent_id-target-right',
      nextSourceHandle: 'table-a-col-id-source-right',
      nextTargetHandle: 'table-b-col-parent_id-target-right',
      waypoints,
    }),
    waypoints,
  );

  assert.equal(
    resolvePreservedWaypoints({
      routingType: 'straight',
      previousSourceHandle: 'table-a-col-id-source-right',
      previousTargetHandle: 'table-b-col-parent_id-target-right',
      nextSourceHandle: 'table-a-col-id-source-left',
      nextTargetHandle: 'table-b-col-parent_id-target-right',
      waypoints,
    }),
    undefined,
  );

  assert.equal(
    resolvePreservedWaypoints({
      routingType: 'smoothstep',
      previousSourceHandle: 'table-a-col-id-source-right',
      previousTargetHandle: 'table-b-col-parent_id-target-right',
      nextSourceHandle: 'table-a-col-id-source-right',
      nextTargetHandle: 'table-b-col-parent_id-target-right',
      waypoints,
    }),
    undefined,
  );
});

test('resolvePreservedWaypoints 는 full replace처럼 handle id 가 달라도 side 조합이 같으면 waypoint 를 유지한다', () => {
  const waypoints = [
    { x: 560, y: 120 },
    { x: 560, y: 280 },
  ];

  assert.deepEqual(
    resolvePreservedWaypoints({
      routingType: 'straight',
      previousSourceHandle: 'table-old-a-col-old-id-source-right',
      previousTargetHandle: 'table-old-b-col-old-parent_id-target-right',
      nextSourceHandle: 'table-new-a-col-new-id-source-right',
      nextTargetHandle: 'table-new-b-col-new-parent_id-target-right',
      previousSourceSide: 'right',
      previousTargetSide: 'right',
      nextSourceSide: 'right',
      nextTargetSide: 'right',
      waypoints,
    }),
    waypoints,
  );

  assert.equal(
    resolvePreservedWaypoints({
      routingType: 'straight',
      previousSourceHandle: 'table-old-a-col-old-id-source-right',
      previousTargetHandle: 'table-old-b-col-old-parent_id-target-right',
      nextSourceHandle: 'table-new-a-col-new-id-source-left',
      nextTargetHandle: 'table-new-b-col-new-parent_id-target-right',
      previousSourceSide: 'right',
      previousTargetSide: 'right',
      nextSourceSide: 'left',
      nextTargetSide: 'right',
      waypoints,
    }),
    undefined,
  );
});
