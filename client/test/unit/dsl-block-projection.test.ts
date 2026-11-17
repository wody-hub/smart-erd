import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateProjection,
  generateTableBlock,
  diffProjection,
  affectedTableIds,
  buildDictionaryTableIndex,
  updateProjection,
  type ProjectionSnapshot,
  type TextPatchBatch,
} from '../../src/lib/dsl-block-projection.js';
import { generateDsl } from '../../src/lib/dsl-generator.js';
import { parseDsl, parseDslBlock, type DslDictionary } from '../../src/lib/dsl-parser.js';
import { buildWordMatchIndex } from '../../src/lib/word-composition.js';
import type { TableNode } from '../../src/types/erd.js';

/** 원본 오프셋 패치를 뒤에서부터 적용한다. */
function apply(text: string, batch: TextPatchBatch): string {
  for (const patch of [...batch.patches].reverse())
    text = text.slice(0, patch.start) + patch.text + text.slice(patch.end);
  return text;
}
/** 이름과 식별자가 다른 최소 그래프를 만든다. */
function fixture(): ProjectionSnapshot {
  return {
    revision: 1,
    nodes: [
      {
        id: 'b',
        data: {
          label: 'physical_child',
          logicalTableName: '자식',
          columns: [
            {
              id: 'bc',
              name: 'physical_fk',
              logicalName: '부모 번호',
              type: 'BIGINT',
              termId: 2,
              domainId: 3,
              nullable: true,
            },
          ],
        },
      },
      {
        id: 'a',
        data: {
          label: 'physical_parent',
          logicalTableName: '부모',
          tableTermId: 1,
          columns: [
            { id: 'ac', name: 'physical_id', logicalName: '번호', type: 'BIGINT', pk: true },
          ],
        },
      },
    ],
    edges: [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        sourceHandle: 'a-ac-source-right',
        targetHandle: 'b-bc-target-left',
        type: 'erdRelation',
        data: { relationType: 'identifying', routingType: 'straight', waypoints: [{ x: 1, y: 2 }] },
      },
    ],
    dictionary: {
      terms: [
        { id: 1, logicalName: '부모' },
        { id: 2, logicalName: '부모 번호', domainId: 3 },
      ],
      domains: [{ id: 3, logicalName: '식별자', physicalType: 'BIGINT' }],
    },
  };
}
const dictionary: DslDictionary = {
  termByName: new Map(),
  domainByName: new Map(),
  domainById: new Map(),
  wordMatchIndex: buildWordMatchIndex([]),
};

test('blocks are deterministic, ID ordered, and retain legacy formatting without headers', () => {
  const snapshot = fixture();
  const projection = generateProjection(snapshot);
  assert.equal(
    projection.text,
    "Table 부모 {\n  번호 ::BIGINT [PK]\n}\n\nTable 자식 {\n  '부모 번호' > 부모.번호 :식별자\n}\n",
  );
  assert.deepEqual(
    projection,
    generateProjection({ ...snapshot, nodes: [...snapshot.nodes].reverse() }),
  );
  const legacy = generateDsl(
    [...snapshot.nodes]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((n) => ({ ...n, position: { x: 0, y: 0 } })) as TableNode[],
    [...snapshot.edges],
    {
      findTermById: (id) => snapshot.dictionary.terms.find((t) => t.id === id),
      findDomainById: (id) => snapshot.dictionary.domains.find((d) => d.id === id),
    },
  );
  assert.equal(legacy.split('\n').slice(3).join('\n'), projection.text);
  assert.equal(generateTableBlock('b', snapshot).text, projection.blocks[1].text);
  assert.throws(() => generateTableBlock('missing', snapshot));
});

test('block parser resolves external FKs and returns lossless detached sidecars and column ranges', () => {
  const snapshot = fixture();
  const block = generateTableBlock('b', snapshot);
  const externalSymbols = new Map([
    ['부모', { physicalName: 'physical_parent', columns: new Map([['번호', 'physical_id']]) }],
  ]);
  const parsed = parseDslBlock(block.text, dictionary, {
    externalSymbols,
    metadata: block.metadata,
  });
  assert.deepEqual(parsed.result.relations, [
    {
      childTable: '자식',
      childColumn: '부모 번호',
      parentTable: 'physical_parent',
      parentColumn: 'physical_id',
    },
  ]);
  assert.deepEqual(parsed.metadata, block.metadata);
  assert.notEqual(parsed.metadata, block.metadata);
  assert.deepEqual(parsed.metadata?.relations[0].edge, snapshot.edges[0]);
  assert.equal(parsed.metadata?.tablePhysicalName, 'physical_child');
  assert.deepEqual(parsed.metadata?.columnIds, ['bc']);
  assert.equal(parsed.metadata?.columns[0].name, 'physical_fk');
  assert.equal(parsed.metadata?.columns[0].termId, 2);
  assert.equal(parsed.metadata?.columns[0].domainId, 3);
  assert.equal(parsed.columnRanges[0].columnId, 'bc');
  assert.equal(
    block.text.slice(parsed.columnRanges[0].start, parsed.columnRanges[0].end),
    "  '부모 번호' > 부모.번호 :식별자",
  );
  assert.equal(parsed.tableRange?.end, block.text.length);
  assert.ok(!parsed.diagnostics.some((d) => d.messageKey.includes('unknownFk')));
  const unresolved = parseDslBlock(block.text, dictionary);
  assert.ok(unresolved.diagnostics.some((d) => d.messageKey === 'erd.dsl.error.unknownFkTable'));
  assert.deepEqual(unresolved.diagnostics, parseDsl(block.text, dictionary).diagnostics);
});

test('ranges use UTF-16 offsets and projection coordinates without separator ownership ambiguity', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.columns[0].logicalName = '번호 😀';
  const projection = generateProjection(snapshot);
  for (const block of projection.blocks) {
    assert.equal(projection.text.slice(block.tableRange.start, block.tableRange.end), block.text);
    for (const range of block.columnRanges) {
      const line = projection.text.split('\n')[range.startLine - 1];
      assert.equal(projection.text.slice(range.start, range.end), line);
      assert.equal(range.endColumn, line.length + 1);
    }
  }
});

test('last valid FK wins deterministically while every relation and omission survives in metadata', () => {
  const snapshot = fixture();
  snapshot.edges.push({
    ...snapshot.edges[0],
    id: 'second',
    source: 'b',
    sourceHandle: 'b-bc-source-left',
  });
  const block = generateTableBlock('b', snapshot);
  assert.match(block.text, /> 자식\.'부모 번호'/);
  assert.deepEqual(block.metadata.unrepresentedRelationIds, ['e']);
  assert.deepEqual(
    block.metadata.relations.map((r) => [r.edge.id, r.emitted]),
    [
      ['e', false],
      ['second', true],
    ],
  );
  const parsed = parseDslBlock(block.text, dictionary, { metadata: block.metadata });
  assert.deepEqual(parsed.metadata, block.metadata);
});

test('dictionary and old/new FK endpoints invalidate dependent tables', () => {
  const prev = fixture();
  const next = structuredClone(prev);
  next.dictionary.domains[0].logicalName = '새 도메인';
  assert.deepEqual([...affectedTableIds(prev, next)].sort(), ['a', 'b']);
  const index = buildDictionaryTableIndex(prev);
  assert.deepEqual([...index.termToTables.get(2)!], ['b']);
  assert.deepEqual([...index.domainToTables.get(3)!], ['b']);
  const removed = structuredClone(prev);
  removed.edges = [];
  assert.deepEqual([...affectedTableIds(prev, removed)].sort(), ['a', 'b']);
  assert.deepEqual([...affectedTableIds(prev, structuredClone(prev))], []);
});

test('patches trim unchanged text inside blocks and use revisions from snapshots', () => {
  const prev = fixture();
  const next = structuredClone(prev);
  next.revision = 2;
  next.nodes[0].data.columns[0].logicalName = '부모 번호2';
  const before = generateProjection(prev);
  const after = generateProjection(next);
  const batch = diffProjection(before, after);
  assert.equal(batch.baseRevision, 1);
  assert.equal(batch.nextRevision, 2);
  const offset = before.text.indexOf("번호'", before.blocks[1].tableRange.start) + 2;
  assert.deepEqual(batch.patches, [{ start: offset, end: offset, text: '2' }]);
  assert.equal(apply(before.text, batch), after.text);
});

test('seeded edits including deletes, cycles, duplicates and special characters match full regeneration', () => {
  let state = 5021;
  const rng = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  let snapshot = fixture();
  let projection = generateProjection(snapshot);
  for (let step = 0; step < 400; step++) {
    const next = structuredClone(snapshot);
    next.revision = step + 2;
    const n = next.nodes[rng() % next.nodes.length];
    const c = n.data.columns[rng() % n.data.columns.length];
    switch (step % 12) {
      case 0:
        n.data.logicalTableName = ['같은 이름', '이름 😀', '한글 \' " 특수'][rng() % 3];
        break;
      case 1:
        c.logicalName = ['중복', '번호 😀', '구분:자 > [값] //'][rng() % 3];
        break;
      case 2:
        n.data.columns.reverse();
        break;
      case 3:
        n.data.columns.push({ id: `c${step}`, name: 'new', type: 'TEXT' });
        break;
      case 4:
        if (n.data.columns.length > 1) n.data.columns.splice(rng() % n.data.columns.length, 1);
        break;
      case 5:
        next.nodes.push({
          id: `table${step}`,
          data: { label: 'duplicate', columns: [{ id: `id${step}`, name: 'id', type: 'INT' }] },
        });
        break;
      case 6:
        if (next.nodes.length > 1) next.nodes.splice(rng() % next.nodes.length, 1);
        break;
      case 7: {
        const parent = next.nodes[rng() % next.nodes.length];
        next.edges.push({
          id: `edge${step}`,
          source: parent.id,
          target: n.id,
          sourceHandle: `${parent.id}-${parent.data.columns[0].id}-source-right`,
          targetHandle: `${n.id}-${c.id}-target-left`,
          data: { relationType: 'non-identifying' },
        });
        break;
      }
      case 8:
        next.edges.splice(0, 1);
        break;
      case 9:
        next.dictionary.domains[0].logicalName = `도메인 ${step}`;
        break;
      case 10:
        next.edges.push({
          id: `self${step}`,
          source: n.id,
          target: n.id,
          sourceHandle: `${n.id}-${c.id}-source-right`,
          targetHandle: `${n.id}-${c.id}-target-left`,
        });
        break;
      case 11:
        next.dictionary.terms[0].logicalName = `용어 ${step}`;
        break;
    }
    const full = generateProjection(next);
    const incremental = updateProjection(projection, snapshot, next);
    assert.deepEqual(incremental, full, `incremental snapshot ${step}`);
    const batch = diffProjection(projection, full);
    for (let i = 1; i < batch.patches.length; i++)
      assert.ok(batch.patches[i - 1].end <= batch.patches[i].start);
    assert.equal(apply(projection.text, batch), full.text, `patch step ${step}`);
    snapshot = next;
    projection = full;
  }
  const empty = generateProjection({ ...snapshot, revision: 999, nodes: [], edges: [] });
  assert.equal(apply(projection.text, diffProjection(projection, empty)), '');
  assert.equal(apply('', diffProjection(empty, projection)), projection.text);
});

test('every ID, physical name and relation attribute survives block parse and regeneration via sidecar', () => {
  const original = fixture();
  original.nodes[0].data.columns.push({
    id: 'extra',
    name: 'original_extra',
    logicalName: '추가',
    type: 'DECIMAL(10,2)',
    pk: false,
    fk: true,
    autoIncrement: false,
    nullable: false,
    termId: 901,
    domainId: 902,
  });
  original.edges.push({
    id: 'orphan',
    source: 'deleted',
    target: 'b',
    targetHandle: 'b-extra-target-left',
    data: {
      relationType: 'non-identifying',
      routingType: 'bezier',
      handleMode: 'manual',
      sourceSide: 'right',
      targetSide: 'left',
    },
  });
  const projection = generateProjection(original);
  const parsed = projection.blocks.map((block) =>
    parseDslBlock(block.text, dictionary, { metadata: block.metadata }),
  );
  const recovered: ProjectionSnapshot = {
    revision: original.revision,
    dictionary: structuredClone(original.dictionary),
    nodes: parsed.map(({ metadata }) => ({
      id: metadata!.tableId,
      data: {
        label: metadata!.tablePhysicalName,
        logicalTableName: metadata!.tableLogicalName,
        tableTermId: metadata!.tableTermId,
        columns: metadata!.columns,
      },
    })),
    edges: parsed.flatMap(({ metadata }) => metadata!.relations.map((relation) => relation.edge)),
  };
  assert.equal(generateProjection(recovered).text, projection.text);
  for (const expected of original.nodes) {
    const actual = recovered.nodes.find((node) => node.id === expected.id)!;
    assert.equal(actual.id, expected.id);
    assert.equal(actual.data.label, expected.data.label);
    assert.equal(actual.data.logicalTableName, expected.data.logicalTableName);
    assert.equal(actual.data.tableTermId, expected.data.tableTermId);
    assert.deepEqual(actual.data.columns, expected.data.columns);
  }
  assert.deepEqual(recovered.edges, original.edges);
  original.nodes[0].data.columns[0].name = 'mutated';
  original.edges[0].data!.waypoints![0].x = 999;
  assert.equal(parsed[1].metadata!.columns[0].name, 'physical_fk');
  assert.equal(parsed[1].metadata!.relations[0].edge.data!.waypoints![0].x, 1);
});

test('self and cyclic FKs resolve without parsing external table blocks', () => {
  const snapshot = fixture();
  snapshot.edges.push({
    id: 'cycle',
    source: 'b',
    target: 'a',
    sourceHandle: 'b-bc-source-right',
    targetHandle: 'a-ac-target-left',
  });
  for (const node of snapshot.nodes) {
    const block = generateTableBlock(node.id, snapshot);
    const externalSymbols = new Map(
      snapshot.nodes
        .filter((other) => other.id !== node.id)
        .map((other) => [
          other.data.logicalTableName!,
          {
            physicalName: other.data.label,
            columns: new Map(
              other.data.columns.map((column) => [column.logicalName!, column.name]),
            ),
          },
        ]),
    );
    const parsed = parseDslBlock(block.text, dictionary, {
      externalSymbols,
      metadata: block.metadata,
    });
    assert.equal(parsed.result.tables.length, 1);
    assert.equal(parsed.result.relations.length, 1);
    assert.ok(!parsed.diagnostics.some((d) => d.messageKey.includes('unknownFk')));
  }
  snapshot.edges = [
    {
      id: 'self',
      source: 'a',
      target: 'a',
      sourceHandle: 'a-ac-source-right',
      targetHandle: 'a-ac-target-left',
    },
  ];
  const block = generateTableBlock('a', snapshot);
  const parsed = parseDslBlock(block.text, dictionary, {
    externalSymbols: new Map([['부모', { physicalName: 'wrong', columns: new Map() }]]),
  });
  assert.deepEqual(parsed.result.relations, [
    { childTable: '부모', childColumn: '번호', parentTable: '부모', parentColumn: '번호' },
  ]);
});

test('unknown external columns preserve FK diagnostics, and stale sidecars never assign positional IDs', () => {
  const block = generateTableBlock('b', fixture());
  const parsed = parseDslBlock(block.text, dictionary, {
    externalSymbols: new Map([['부모', { physicalName: 'parent', columns: new Map() }]]),
  });
  assert.ok(parsed.diagnostics.some((d) => d.messageKey === 'erd.dsl.error.unknownFkColumn'));
  const edited = parseDslBlock(block.text.replace('부모 번호', '새 컬럼'), dictionary, {
    metadata: block.metadata,
  });
  assert.equal(edited.metadataMatchesText, false);
  assert.equal(edited.columnRanges[0].columnId, undefined);
  assert.deepEqual(edited.metadata, block.metadata);
  assert.equal(parseDslBlock('', dictionary).tableRange, undefined);
  assert.ok(
    parseDslBlock(block.text + '\n' + block.text, dictionary).result.errors.includes(
      'Expected a single DSL table block',
    ),
  );
});

test('duplicate display names preserve distinct block IDs and retain column diagnostics', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.logicalTableName = '부모';
  snapshot.nodes[0].data.columns.push({ ...snapshot.nodes[0].data.columns[0], id: 'duplicate' });
  const projection = generateProjection(snapshot);
  assert.deepEqual(
    projection.blocks.map((block) => block.tableId),
    ['a', 'b'],
  );
  const parsed = parseDslBlock(projection.blocks[1].text, dictionary, {
    metadata: projection.blocks[1].metadata,
  });
  assert.ok(
    parsed.diagnostics.some((d) => d.messageKey === 'erd.dsl.error.duplicateColumnLogicalName'),
  );
  assert.deepEqual(
    parsed.columnRanges.map((range) => range.columnId),
    ['bc', 'duplicate'],
  );
});

test('legacy delimiter limitations remain visible while special-character originals survive in sidecar', () => {
  const snapshot = fixture();
  snapshot.nodes[0].data.columns[0].logicalName = '구분:자 > [값] // 😀';
  const block = generateTableBlock('b', snapshot);
  const parsed = parseDslBlock(block.text, dictionary, { metadata: block.metadata });
  // 기존 포맷은 구분 문자를 이스케이프하지 않는다. sidecar를 파싱 결과로 덮어쓰지 않는다.
  assert.equal(parsed.metadataMatchesText, false);
  assert.equal(parsed.metadata!.columns[0].logicalName, '구분:자 > [값] // 😀');
  assert.ok(parsed.diagnostics.length > 0);
});

test('dictionary term inheritance, retargeted FKs and FK order changes invalidate old and new users', () => {
  const prev = fixture();
  prev.nodes.push({
    id: 'c',
    data: { label: 'third', columns: [{ id: 'cc', name: 'id', type: 'INT', termId: 4 }] },
  });
  prev.dictionary.terms.push({ id: 4, logicalName: '상속', domainId: 9 });
  prev.dictionary.domains.push({ id: 9, logicalName: '상속 도메인' });
  const domainChanged = structuredClone(prev);
  domainChanged.dictionary.domains[1].physicalType = 'TEXT';
  assert.deepEqual([...affectedTableIds(prev, domainChanged)], ['c']);
  const termChanged = structuredClone(prev);
  termChanged.dictionary.terms[2].physicalName = 'new';
  assert.deepEqual([...affectedTableIds(prev, termChanged)], ['c']);
  const retargeted = structuredClone(prev);
  retargeted.edges[0].source = 'c';
  retargeted.edges[0].sourceHandle = 'c-cc-source-right';
  assert.deepEqual([...affectedTableIds(prev, retargeted)], ['a', 'b', 'c']);
  prev.edges.push({
    ...prev.edges[0],
    id: 'other',
    source: 'c',
    sourceHandle: 'c-cc-source-right',
  });
  const reordered = structuredClone(prev);
  reordered.edges.reverse();
  assert.deepEqual([...affectedTableIds(prev, reordered)], ['a', 'b', 'c']);
  const before = generateProjection(prev),
    after = updateProjection(before, prev, reordered);
  assert.match(after.blocks[1].text, /> 부모.번호/);
  assert.equal(
    apply(before.text, diffProjection(before, after)),
    generateProjection(reordered).text,
  );
});

test('table insertion and removal at every boundary leave unaffected block text untouched', () => {
  const base = fixture();
  for (const id of ['0', 'aa', 'z', '😀', '가']) {
    const next = structuredClone(base);
    next.nodes.push({ id, data: { label: 'inserted', columns: [] } });
    const before = generateProjection(base),
      after = generateProjection(next);
    assert.equal(apply(before.text, diffProjection(before, after)), after.text);
    assert.equal(apply(after.text, diffProjection(after, before)), before.text);
  }
  const before = generateProjection(base);
  assert.deepEqual(diffProjection(before, before).patches, []);
  assert.throws(() => updateProjection(before, { ...base, revision: 'stale' }, base));
});

test('reordering FKs on different child columns refreshes sidecar order as well as text', () => {
  const prev = fixture();
  prev.nodes[0].data.columns.push({ id: 'bc2', name: 'second_fk', type: 'BIGINT' });
  prev.edges.push({ ...prev.edges[0], id: 'second', targetHandle: 'b-bc2-target-left' });
  const next = structuredClone(prev);
  next.revision = 2;
  next.edges.reverse();
  const before = generateProjection(prev);
  const updated = updateProjection(before, prev, next);
  assert.deepEqual(updated, generateProjection(next));
  assert.deepEqual(
    updated.blocks[1].metadata.relations.map((relation) => relation.edge.id),
    ['second', 'e'],
  );
  assert.deepEqual(diffProjection(before, updated).patches, []);
});

test('quoted whitespace, both quote styles and astral characters parse with external symbols', () => {
  const snapshot = fixture();
  snapshot.nodes[1].data.logicalTableName = 'O\'Reilly "고객" 😀';
  snapshot.nodes[1].data.columns[0].logicalName = '번호 \' " 😀';
  snapshot.nodes[0].data.columns[0].logicalName = '참조 \' " 😀';
  const block = generateTableBlock('b', snapshot);
  const externalSymbols = new Map([
    [
      snapshot.nodes[1].data.logicalTableName,
      {
        physicalName: 'physical_parent',
        columns: new Map([[snapshot.nodes[1].data.columns[0].logicalName, 'physical_id']]),
      },
    ],
  ]);
  const parsed = parseDslBlock(block.text, dictionary, {
    externalSymbols,
    metadata: block.metadata,
  });
  assert.equal(parsed.result.relations[0]?.parentColumn, 'physical_id');
  assert.equal(parsed.columnRanges[0].logicalName, '참조 \' " 😀');
  assert.equal(parsed.metadataMatchesText, true);
});

test('removing the first block coalesces its adjacent separator deletion', () => {
  const snapshot = fixture();
  snapshot.edges = [];
  const before = generateProjection(snapshot);
  const after = generateProjection({
    ...snapshot,
    revision: 2,
    nodes: [snapshot.nodes[0]],
    edges: [],
  });
  const batch = diffProjection(before, after);
  assert.deepEqual(batch.patches, [{ start: 0, end: before.blocks[1].tableRange.start, text: '' }]);
  assert.equal(apply(before.text, batch), after.text);
});
