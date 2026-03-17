import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildStableEdgeId,
  getAllowedEdgeHandleSelectionValues,
  getAllowedHandleSides,
  getCurrentEdgeHandleSelectionValue,
  parseEdgeHandleSelectionValue,
  resolveAutoEdgeHandles,
  resolveEdgeHandlesFromPreference,
} from '../../src/lib/edge-handles.js';
import { buildColumnHandleId, extractColId } from '../../src/lib/handle-id.js';

test('extractColId 는 side-aware handle ID 에서도 컬럼 ID를 추출한다', () => {
  const handleId = buildColumnHandleId('table-a', 'col-id', 'source', 'left');
  assert.equal(extractColId(handleId, 'table-a'), 'col-id');
});

test('getAllowedHandleSides 는 split 에서 양쪽 side 를 허용한다', () => {
  assert.deepEqual(getAllowedHandleSides('split'), ['left', 'right']);
  assert.deepEqual(getAllowedHandleSides('left'), ['left']);
  assert.deepEqual(getAllowedHandleSides('right'), ['right']);
});

test('getAllowedEdgeHandleSelectionValues 는 handleLayout 제약을 반영한다', () => {
  assert.deepEqual(getAllowedEdgeHandleSelectionValues('right', 'split'), [
    'auto',
    'right-left',
    'right-right',
  ]);
});

test('getCurrentEdgeHandleSelectionValue 는 manual 모드에서 현재 side 조합을 반환한다', () => {
  assert.equal(
    getCurrentEdgeHandleSelectionValue({
      handleMode: 'manual',
      sourceHandle: 'table-a-col-a-source-left',
      targetHandle: 'table-b-col-b-target-right',
    }),
    'left-right',
  );
});

test('parseEdgeHandleSelectionValue 는 auto/manual selection 을 해석한다', () => {
  assert.deepEqual(parseEdgeHandleSelectionValue('auto'), { handleMode: 'auto' });
  assert.deepEqual(parseEdgeHandleSelectionValue('right-left'), {
    handleMode: 'manual',
    sourceSide: 'right',
    targetSide: 'left',
  });
});

test('resolveAutoEdgeHandles 는 좌우로 떨어진 테이블에서 inner side 를 고른다', () => {
  const resolved = resolveAutoEdgeHandles({
    sourceNode: {
      id: 'parent',
      position: { x: 100, y: 100 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    targetNode: {
      id: 'child',
      position: { x: 760, y: 160 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    sourceColId: 'parent-col',
    targetColId: 'child-col',
  });

  assert.equal(resolved.sourceHandle, 'parent-parent-col-source-right');
  assert.equal(resolved.targetHandle, 'child-child-col-target-left');
});

test('resolveAutoEdgeHandles 는 수직 배치에서 하위 테이블이 더 오른쪽이면 right-right 를 고른다', () => {
  const resolved = resolveAutoEdgeHandles({
    sourceNode: {
      id: 'code-group',
      position: { x: 180, y: 80 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    targetNode: {
      id: 'code',
      position: { x: 240, y: 480 },
      width: 300,
      data: { handleLayout: 'split' },
    },
    sourceColId: 'cd-grp-id',
    targetColId: 'cd-grp-id',
  });

  assert.equal(resolved.sourceHandle, 'code-group-cd-grp-id-source-right');
  assert.equal(resolved.targetHandle, 'code-cd-grp-id-target-right');
});

test('resolveAutoEdgeHandles 는 큰 수평 overlap 이 있으면 좌우 대칭 same-side 를 우선한다', () => {
  const resolved = resolveAutoEdgeHandles({
    sourceNode: {
      id: 'child',
      position: { x: 260, y: 480 },
      width: 360,
      data: { handleLayout: 'split' },
    },
    targetNode: {
      id: 'parent',
      position: { x: 180, y: 80 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    sourceColId: 'child-col',
    targetColId: 'parent-col',
  });

  assert.equal(resolved.sourceHandle, 'child-child-col-source-left');
  assert.equal(resolved.targetHandle, 'parent-parent-col-target-left');
});

test('resolveAutoEdgeHandles 는 작은 overlap 에서는 inner side 조합을 유지한다', () => {
  const resolved = resolveAutoEdgeHandles({
    sourceNode: {
      id: 'left',
      position: { x: 100, y: 100 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    targetNode: {
      id: 'right',
      position: { x: 480, y: 420 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    sourceColId: 'source-col',
    targetColId: 'target-col',
  });

  assert.equal(resolved.sourceHandle, 'left-source-col-source-right');
  assert.equal(resolved.targetHandle, 'right-target-col-target-left');
});

test('resolveAutoEdgeHandles 는 handleLayout 강제 side 를 존중한다', () => {
  const resolved = resolveAutoEdgeHandles({
    sourceNode: {
      id: 'parent',
      position: { x: 500, y: 100 },
      width: 420,
      data: { handleLayout: 'right' },
    },
    targetNode: {
      id: 'child',
      position: { x: 120, y: 100 },
      width: 420,
      data: { handleLayout: 'left' },
    },
    sourceColId: 'parent-col',
    targetColId: 'child-col',
  });

  assert.equal(resolved.sourceHandle, 'parent-parent-col-source-right');
  assert.equal(resolved.targetHandle, 'child-child-col-target-left');
});

test('resolveEdgeHandlesFromPreference 는 manual selection 을 유지한다', () => {
  const resolved = resolveEdgeHandlesFromPreference({
    sourceNode: {
      id: 'parent',
      position: { x: 100, y: 100 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    targetNode: {
      id: 'child',
      position: { x: 760, y: 160 },
      width: 420,
      data: { handleLayout: 'split' },
    },
    sourceColId: 'parent-col',
    targetColId: 'child-col',
    handleMode: 'manual',
    sourceSide: 'left',
    targetSide: 'left',
  });

  assert.equal(resolved.handleMode, 'manual');
  assert.equal(resolved.sourceHandle, 'parent-parent-col-source-left');
  assert.equal(resolved.targetHandle, 'child-child-col-target-left');
});

test('resolveEdgeHandlesFromPreference 는 manual side 가 불가능하면 현재 layout 으로 보정한다', () => {
  const resolved = resolveEdgeHandlesFromPreference({
    sourceNode: {
      id: 'parent',
      position: { x: 100, y: 100 },
      width: 420,
      data: { handleLayout: 'right' },
    },
    targetNode: {
      id: 'child',
      position: { x: 760, y: 160 },
      width: 420,
      data: { handleLayout: 'left' },
    },
    sourceColId: 'parent-col',
    targetColId: 'child-col',
    handleMode: 'manual',
    sourceSide: 'left',
    targetSide: 'right',
  });

  assert.equal(resolved.handleMode, 'manual');
  assert.equal(resolved.sourceSide, 'right');
  assert.equal(resolved.targetSide, 'left');
  assert.equal(resolved.sourceHandle, 'parent-parent-col-source-right');
  assert.equal(resolved.targetHandle, 'child-child-col-target-left');
});

test('buildStableEdgeId 는 relation 의미 기준으로 결정적 ID를 만든다', () => {
  assert.equal(
    buildStableEdgeId({
      parentTable: 'code_group',
      parentColumn: 'cd_grp_id',
      childTable: 'code',
      childColumn: 'cd_grp_id',
    }),
    'rel:code_group.cd_grp_id-%3Ecode.cd_grp_id',
  );
});
