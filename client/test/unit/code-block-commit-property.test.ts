import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateTableBlock, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';
import { computeBlockCommit } from '../../src/lib/code-block-commit.js';
import type { CodeBlockCommit } from '../../src/lib/code-block-commit-contract.js';

type SeedBuilder = (count: number, seed?: number) => Pick<ProjectionSnapshot, 'nodes' | 'edges'>;
/** 실제 성능 시드 생성기를 서버 없이 불러온다. */
async function seedBuilder(): Promise<SeedBuilder> {
  return (await import(pathToFileURL(resolve('scripts/perf/lib/erd-app-seed.mjs')).href))
    .buildErdLocalSeed;
}
/** 계약의 필드 패치를 독립적인 일반 객체에 적용한다. 구조 연산은 존재하지 않는다. */
function apply(snapshot: ProjectionSnapshot, commit: CodeBlockCommit): ProjectionSnapshot {
  const nodes = snapshot.nodes.map((node) =>
    node.id !== commit.tableId
      ? node
      : { ...node, data: { ...node.data, columns: node.data.columns.map((col) => ({ ...col })) } },
  );
  const data = nodes.find((node) => node.id === commit.tableId)!.data;
  for (const patch of commit.patches) {
    const entity =
      patch.target === 'table' ? data : data.columns.find((col) => col.id === patch.columnId)!;
    Object.assign(entity, { [patch.field]: patch.nextValue });
  }
  return { ...snapshot, nodes };
}

test('100 seeds × 100 Unicode field edits on S200: parse → commit → independent apply → regenerate', async () => {
  const build = await seedBuilder();
  for (let seed = 0; seed < 100; seed++) {
    let state = seed + 1;
    const rng = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    let snapshot: ProjectionSnapshot = {
      ...build(200, seed),
      revision: 0,
      dictionary: { terms: [], domains: [] },
    };
    for (let step = 0; step < 100; step++) {
      const index = rng() % 200,
        node = snapshot.nodes[index];
      const base = generateTableBlock(node.id, snapshot);
      const expected = { ...snapshot, nodes: [...snapshot.nodes] };
      const data = { ...node.data, columns: node.data.columns.map((col) => ({ ...col })) };
      expected.nodes[index] = { ...node, data };
      const col = data.columns[rng() % data.columns.length];
      const name =
        ['한글😀', '日本語', 'café', 'Ω_é', '이름 空白', '𐐀名'][rng() % 6] + `_${seed}_${step}`;
      switch (rng() % 5) {
        case 0:
          col.name = name;
          col.logicalName = name;
          break;
        case 1:
          data.label = name;
          data.logicalTableName = name;
          break;
        case 2:
          col.type = ['BIGINT', 'TEXT', 'DECIMAL(12,3)', 'VARCHAR(72)'][rng() % 4];
          break;
        case 3:
          col.pk = !col.pk;
          if (col.pk) col.nullable = false;
          break;
        case 4:
          col.pk = false;
          col.nullable = !col.nullable;
          break;
      }
      const edited = generateTableBlock(node.id, expected).text;
      const result = computeBlockCommit({
        base,
        edited,
        currentSnapshot: snapshot,
        dictionaryFingerprint: 'empty',
        commitId: `${seed}-${step}`,
      });
      assert.ok('kind' in result, `seed=${seed}, step=${step}: ${JSON.stringify(result)}`);
      if (!('kind' in result)) return;
      const actual = apply(snapshot, result);
      assert.equal(generateTableBlock(node.id, actual).text, edited, `seed=${seed}, step=${step}`);
      assert.equal(actual.edges, snapshot.edges);
      assert.deepEqual(
        actual.nodes[index].data.columns.map((c) => c.id),
        node.data.columns.map((c) => c.id),
      );
      const unsupported = computeBlockCommit({
        base,
        edited: edited.replace(/\n}\n$/, '\n  added ::INT\n}\n'),
        currentSnapshot: snapshot,
        dictionaryFingerprint: 'empty',
        commitId: 'bad',
      });
      assert.equal('kind' in unsupported, false);
      assert.equal('status' in unsupported && unsupported.status, 'unsupported');
      snapshot = actual;
    }
  }
});

test('computeBlockCommit single-block S200/S500 benchmark: 100 warmups / 1000 samples', async () => {
  const build = await seedBuilder();
  for (const size of [200, 500]) {
    const snapshot: ProjectionSnapshot = {
      ...build(size),
      revision: 0,
      dictionary: { terms: [], domains: [] },
    };
    const base = generateTableBlock(snapshot.nodes[size - 1].id, snapshot);
    const edited = base.text.replace('::BIGINT', '::INTEGER');
    const run = () =>
      computeBlockCommit({
        base,
        edited,
        currentSnapshot: snapshot,
        dictionaryFingerprint: 'empty',
        commitId: 'bench',
      });
    for (let i = 0; i < 100; i++) run();
    const times: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      const result = run();
      times.push(performance.now() - start);
      assert.ok('kind' in result);
    }
    times.sort((a, b) => a - b);
    console.log(
      `computeBlockCommit S${size}: p50=${times[499].toFixed(3)}ms p95=${times[949].toFixed(3)}ms`,
    );
    assert.ok(Number.isFinite(times[949]));
  }
});
