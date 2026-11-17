import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateTableBlock, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';
import {
  bindBlockIds,
  computeBlockCommit,
  classifyField,
  mergeRemoteIntoLocalEdit,
  isOwnCommitEcho,
  ownCommitEchoPatchIndexes,
} from '../../src/lib/code-block-commit.js';
import type { CodeBlockCommit } from '../../src/lib/code-block-commit-contract.js';

/** 안정 ID·관계 속성을 가진 스냅샷을 만든다. */
export function fixture(): ProjectionSnapshot {
  return {
    revision: 1,
    dictionary: { terms: [], domains: [] },
    nodes: [
      {
        id: 't',
        data: {
          label: 'physical',
          logicalTableName: '테이블',
          columns: [
            { id: 'a', name: 'a_physical', logicalName: '첫째', type: 'INT', nullable: true },
            { id: 'b', name: 'b_physical', logicalName: '둘째', type: 'TEXT', nullable: false },
          ],
        },
      },
    ],
    edges: [
      {
        id: 'edge',
        source: 't',
        target: 't',
        sourceHandle: 't-a-source-right',
        targetHandle: 't-b-target-left',
        data: { relationType: 'identifying', routingType: 'straight', waypoints: [{ x: 1, y: 2 }] },
      },
    ],
  };
}
/** 계약 필드만 독립 참조 스냅샷에 적용한다. */
export function apply(snapshot: ProjectionSnapshot, commit: CodeBlockCommit): ProjectionSnapshot {
  const next = structuredClone(snapshot);
  for (const patch of commit.patches) {
    const data = next.nodes.find((node) => node.id === patch.tableId)!.data;
    const entity =
      patch.target === 'table' ? data : data.columns.find((col) => col.id === patch.columnId)!;
    Object.assign(entity, { [patch.field]: patch.nextValue });
  }
  return next;
}
for (const [base, local, current, expected] of [
  [0, 0, 0, 'unchanged'],
  [0, 1, 0, 'local-only'],
  [0, 0, 1, 'remote-only'],
  [0, 1, 1, 'same-change'],
  [0, 1, 2, 'conflict'],
] as const) {
  test(`classifies ${expected}`, () => assert.equal(classifyField(base, local, current), expected));
}

test('rename binds stable IDs and emits zero structural/edge operations', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot);
  const text = block.text.replace('첫째 ::INT', '새이름😀 ::BIGINT');
  const bound = bindBlockIds(block, text);
  assert.equal(bound.status, 'bound');
  if (bound.status === 'bound')
    assert.deepEqual(
      bound.parsed.columnRanges.map((range) => range.columnId),
      ['a', 'b'],
    );
  const commit = computeBlockCommit({
    base: block,
    edited: text,
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in commit);
  if (!('kind' in commit)) return;
  assert.deepEqual(
    commit.patches.map((patch) => patch.field),
    ['name', 'logicalName', 'type'],
  );
  assert.ok(commit.patches.every((patch) => patch.target === 'column' && patch.columnId === 'a'));
  const next = apply(snapshot, commit);
  assert.equal(
    generateTableBlock('t', next).text,
    text.replace('> 테이블.첫째', '> 테이블.새이름😀'),
  );
  assert.deepEqual(next.edges, snapshot.edges);
  assert.deepEqual(
    next.nodes[0].data.columns.map((col) => col.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    Object.keys(commit).sort(),
    ['kind', 'commitId', 'tableId', 'dictionaryFingerprint', 'patches'].sort(),
  );
});

test('structural/FK/domain/AI edits are unsupported, duplicates invalid', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot),
    lines = block.text.split('\n');
  const edits = [
    block.text + block.text,
    '',
    block.text.replace('  첫째 ::INT\n', ''),
    [lines[0], lines[2], lines[1], ...lines.slice(3)].join('\n'),
    block.text.replace('> 테이블.첫째', '> 테이블.둘째'),
    block.text.replace('::INT', ':도메인'),
    block.text.replace('::INT', '::INT [AI]'),
  ];
  for (const edited of edits) {
    const result = computeBlockCommit({
      base: block,
      edited,
      currentSnapshot: snapshot,
      dictionaryFingerprint: 'd',
      commitId: 'id',
    });
    assert.equal('kind' in result, false, edited);
    assert.equal('status' in result && result.status, 'unsupported', edited);
  }
  const invalid = computeBlockCommit({
    base: block,
    edited: block.text.replace('첫째 ::INT', '둘째 ::INT'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.equal('status' in invalid && invalid.status, 'invalid');
  assert.ok(
    'diagnostics' in invalid &&
      invalid.diagnostics.some(
        (d) => d.severity === 'error' && d.line > 0 && d.endColumn > d.startColumn,
      ),
  );
});

test('dictionary-linked name/type changes are deferred', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.columns[0].termId = 42;
  const block = generateTableBlock('t', snapshot);
  const result = computeBlockCommit({
    base: block,
    edited: block.text.replace('::INT', '::TEXT'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('reasons' in result && result.reasons.includes('dictionary-linked'));
});

test('remote-only fields update base without rewriting text or emitting stale values', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot),
    text = block.text.replace('첫째 ::INT', '로컬😀 ::INT');
  const remote = structuredClone(snapshot);
  remote.nodes[0].data.columns[0].type = 'BIGINT';
  const merged = mergeRemoteIntoLocalEdit({
    base: block,
    edited: text,
    authoritativeBlock: generateTableBlock('t', remote),
  });
  assert.equal(merged.status, 'merged');
  if (merged.status !== 'merged') return;
  assert.equal(merged.edited, text);
  assert.equal(merged.base.metadata.columns[0].type, 'BIGINT');
  const commit = computeBlockCommit({
    base: merged.base,
    edited: text,
    currentSnapshot: remote,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in commit);
  if ('kind' in commit)
    assert.deepEqual(
      commit.patches.map((p) => p.field),
      ['name', 'logicalName'],
    );
});

test('conflicts and remote deletion never recreate entities', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot),
    text = block.text.replace('::INT', '::BIGINT');
  const remote = structuredClone(snapshot);
  remote.nodes[0].data.columns[0].type = 'TEXT';
  const merged = mergeRemoteIntoLocalEdit({
    base: block,
    edited: text,
    authoritativeBlock: generateTableBlock('t', remote),
  });
  assert.equal(merged.status, 'conflict');
  if (merged.status === 'conflict') assert.equal(merged.conflicts[0].field, 'type');
  assert.equal(
    mergeRemoteIntoLocalEdit({ base: block, edited: text, authoritativeBlock: null }).status,
    'entity-removed',
  );
});

test('echo requires matching values, not merely batch identity', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot);
  const commit = computeBlockCommit({
    base: block,
    edited: block.text.replace('::INT', '::BIGINT'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in commit);
  if (!('kind' in commit)) return;
  const next = apply(snapshot, commit);
  assert.equal(isOwnCommitEcho(['id'], generateTableBlock('t', next), commit, block), true);
  next.nodes[0].data.columns[0].type = 'TEXT';
  assert.equal(isOwnCommitEcho(['id'], generateTableBlock('t', next), commit, block), false);
  assert.equal(isOwnCommitEcho([], block, commit), false);
});

test('same-change advances comparison baseline, then reverting creates a new patch', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot),
    text = block.text.replace('::INT', '::BIGINT');
  const remote = structuredClone(snapshot);
  remote.nodes[0].data.columns[0].type = 'BIGINT';
  const merged = mergeRemoteIntoLocalEdit({
    base: block,
    edited: text,
    authoritativeBlock: generateTableBlock('t', remote),
  });
  assert.equal(merged.status, 'merged');
  if (merged.status !== 'merged') return;
  const noChange = computeBlockCommit({
    base: merged.base,
    edited: text,
    currentSnapshot: remote,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in noChange);
  if ('kind' in noChange) assert.deepEqual(noChange.patches, []);
  const reverted = computeBlockCommit({
    base: merged.base,
    edited: block.text,
    currentSnapshot: remote,
    dictionaryFingerprint: 'd',
    commitId: 'id2',
  });
  assert.ok('kind' in reverted);
  if ('kind' in reverted)
    assert.deepEqual(
      reverted.patches.map((p) => [p.field, p.baseValue, p.nextValue]),
      [['type', 'BIGINT', 'INT']],
    );
});

test('foreign changes to untouched fields prevent whole-block echo suppression', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot);
  const commit = computeBlockCommit({
    base: block,
    edited: block.text.replace('::INT', '::BIGINT'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in commit);
  if (!('kind' in commit)) return;
  const remote = apply(snapshot, commit);
  remote.nodes[0].data.columns[1].nullable = true;
  assert.equal(
    isOwnCommitEcho(['id', 'foreign'], generateTableBlock('t', remote), commit, block),
    false,
  );
  assert.deepEqual(
    ownCommitEchoPatchIndexes(['id', 'foreign'], generateTableBlock('t', remote), commit),
    [0],
  );
  assert.equal(
    isOwnCommitEcho(['id'], generateTableBlock('t', apply(snapshot, commit)), commit),
    false,
  );
});

test('linked domain permits PK-only edit without reinterpreting name or type', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.columns[0].domainId = 1;
  snapshot.dictionary.domains.push({ id: 1, logicalName: '정수', physicalType: 'INT' });
  const block = generateTableBlock('t', snapshot);
  const result = computeBlockCommit({
    base: block,
    edited: block.text.replace(':정수', ':정수 [PK]'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in result, JSON.stringify(result));
  if ('kind' in result)
    assert.deepEqual(
      result.patches.map((p) => p.field),
      ['pk', 'nullable'],
    );
});

test('invalid type removal and malformed option syntax cannot masquerade as field edits', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot);
  for (const edited of [
    block.text.replace(' ::INT', ''),
    block.text.replace('첫째 ::INT', '첫째 [PK'),
    block.text.replace('첫째 ::INT', '첫째 ::!'),
  ]) {
    const result = computeBlockCommit({
      base: block,
      edited,
      currentSnapshot: snapshot,
      dictionaryFingerprint: 'd',
      commitId: 'id',
    });
    assert.equal('status' in result && result.status, 'invalid');
  }
});

test('edit provenance rejects indistinguishable block replacements and sidecars bind renames', () => {
  const snapshot = fixture(),
    block = generateTableBlock('t', snapshot),
    edited = block.text.replace('첫째 ::INT', '새이름 ::INT');
  assert.equal(bindBlockIds(block.metadata, edited).status, 'bound');
  for (const editKind of ['block-paste', 'duplicate', 'replace-lines', 'reorder'] as const) {
    const result = computeBlockCommit({
      base: block,
      edited,
      editKind,
      currentSnapshot: snapshot,
      dictionaryFingerprint: 'd',
      commitId: 'id',
    });
    assert.equal('status' in result && result.status, 'unsupported');
  }
});

test('current target removal, duplicate physical names, and observed conflict produce no commit', () => {
  const snapshot = fixture(),
    base = generateTableBlock('t', snapshot),
    edited = base.text.replace('::INT', '::BIGINT');
  const removed = { ...snapshot, nodes: [] };
  const conflict = structuredClone(snapshot);
  conflict.nodes[0].data.columns[0].type = 'TEXT';
  const duplicate = structuredClone(snapshot);
  duplicate.nodes[0].data.columns[1].name = 'A_PHYSICAL';
  for (const currentSnapshot of [removed, conflict, duplicate]) {
    assert.equal(
      'kind' in
        computeBlockCommit({
          base,
          edited,
          currentSnapshot,
          dictionaryFingerprint: 'd',
          commitId: 'id',
        }),
      false,
    );
  }
  const dictionaryChanged = computeBlockCommit({
    base: { ...base, dictionaryFingerprint: 'old' },
    edited,
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'new',
    commitId: 'id',
  });
  assert.ok(
    'reasons' in dictionaryChanged && dictionaryChanged.reasons.includes('dictionary-changed'),
  );
});

test('remote merge preserves supplied dictionary fingerprint and immutable inputs', () => {
  const snapshot = fixture(),
    base = { ...generateTableBlock('t', snapshot), dictionaryFingerprint: 'd' },
    edited = base.text.replace('::INT', '::BIGINT');
  const before = structuredClone(base),
    remote = generateTableBlock('t', snapshot);
  assert.equal(
    mergeRemoteIntoLocalEdit({ base, edited, authoritativeBlock: remote }).status,
    'merged',
  );
  assert.deepEqual(base, before);
});

test('foreign FK display changes accompanying own echo are still visible', () => {
  const snapshot = fixture(),
    base = generateTableBlock('t', snapshot);
  const commit = computeBlockCommit({
    base,
    edited: base.text.replace('::INT', '::BIGINT'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'id',
  });
  assert.ok('kind' in commit);
  if (!('kind' in commit)) return;
  const authoritative = generateTableBlock('t', apply(snapshot, commit));
  assert.equal(
    isOwnCommitEcho(
      ['id'],
      { ...authoritative, text: authoritative.text.replace('> 테이블.첫째', '> 외부변경.첫째') },
      commit,
      base,
    ),
    false,
  );
});

for (const label of ['occupied', '기존논리명'])
  test(`table rename rejects an existing physical or logical DSL target: ${label}`, () => {
    const snapshot = fixture();
    snapshot.nodes.push({
      id: 'other',
      data: { label: 'occupied', logicalTableName: '기존논리명', columns: [] },
    });
    const base = generateTableBlock('t', snapshot);
    const result = computeBlockCommit({
      base,
      edited: base.text.replace('테이블 {', `${label} {`),
      currentSnapshot: snapshot,
      dictionaryFingerprint: 'd',
      commitId: 'rename',
    });
    assert.ok(!('kind' in result));
    if (!('kind' in result)) assert.deepEqual(result.reasons, ['duplicate-name']);
  });
test('pre-existing duplicate physical names reject even a type edit before positional ID binding', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.columns[1].name = snapshot.nodes[0].data.columns[0].name;
  const base = generateTableBlock('t', snapshot);
  const result = computeBlockCommit({
    base,
    edited: base.text.replace('::INT', '::BIGINT'),
    currentSnapshot: snapshot,
    dictionaryFingerprint: 'd',
    commitId: 'edit',
  });
  assert.ok(!('kind' in result));
  if (!('kind' in result)) {
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.reasons, ['duplicate-name']);
    assert.ok(result.diagnostics.length);
  }
});

test('pre-existing duplicate names never bind stable IDs by position', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.columns[1].name = snapshot.nodes[0].data.columns[0].name;
  const base = generateTableBlock('t', snapshot);
  const result = bindBlockIds(base, base.text);
  assert.equal(result.status, 'invalid');
  assert.equal(result.diagnostics[0].messageKey, 'erd.unifiedEditing.duplicateColumnNames');
  assert.match(result.diagnostics[0].messageArgs!.names, /a_physical/);
});
