import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildRevisionHash,
  sortObjectKeys,
  type RevisionSnapshotEdge,
  type RevisionSnapshotNode,
} from '../../src/lib/code-sync-revision.js';

test('sortObjectKeys 는 중첩 객체 키를 안정적으로 정렬한다', () => {
  const value = {
    b: 1,
    a: { z: 3, y: [{ d: 4, c: 5 }] },
  };

  const sorted = sortObjectKeys(value) as {
    a: { y: Array<{ c: number; d: number }>; z: number };
    b: number;
  };

  assert.deepEqual(Object.keys(sorted), ['a', 'b']);
  assert.deepEqual(Object.keys(sorted.a), ['y', 'z']);
  assert.deepEqual(Object.keys(sorted.a.y[0]), ['c', 'd']);
});

test('buildRevisionHash 는 입력 순서가 달라도 동일 해시를 반환한다', () => {
  const nodeA: RevisionSnapshotNode = {
    id: 'n-a',
    type: 'table',
    parentId: null,
    data: { label: 'A', columns: [{ id: 'c1', name: 'id' }] },
  };
  const nodeB: RevisionSnapshotNode = {
    id: 'n-b',
    type: 'table',
    parentId: null,
    data: { label: 'B', columns: [{ id: 'c1', name: 'id' }] },
  };
  const edge: RevisionSnapshotEdge = {
    id: 'e-1',
    source: 'n-a',
    target: 'n-b',
    sourceHandle: 'n-a-c1-source',
    targetHandle: 'n-b-c1-target',
    type: 'erdRelation',
    data: { relationType: 'non-identifying' },
  };

  const hash1 = buildRevisionHash([nodeA, nodeB], [edge]);
  const hash2 = buildRevisionHash([nodeB, nodeA], [edge]);

  assert.equal(hash1, hash2);
});

test('buildRevisionHash 는 의미 있는 변경 시 다른 해시를 반환한다', () => {
  const baseNode: RevisionSnapshotNode = {
    id: 'n-a',
    type: 'table',
    parentId: null,
    data: { label: 'A', columns: [{ id: 'c1', name: 'id' }] },
  };

  const changedNode: RevisionSnapshotNode = {
    ...baseNode,
    data: {
      label: 'A',
      columns: [
        { id: 'c1', name: 'id' },
        { id: 'c2', name: 'name' },
      ],
    },
  };

  const baseHash = buildRevisionHash([baseNode], []);
  const changedHash = buildRevisionHash([changedNode], []);

  assert.notEqual(baseHash, changedHash);
});
