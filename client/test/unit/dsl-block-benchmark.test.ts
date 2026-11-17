import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  generateProjection,
  updateProjection,
  diffProjection,
  type ProjectionSnapshot,
  type DslProjection,
} from '../../src/lib/dsl-block-projection.js';

/** 워밍업 후 동기 처리의 p50/p95를 측정한다. */
function measure(run: () => void): { p50: number; p95: number } {
  for (let i = 0; i < 100; i++) run();
  const times: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { p50: times[499], p95: times[949] };
}

test('S200/S500 pure generation and incremental patch benchmark (100 warmup / 1000 samples)', async () => {
  const seedUrl = pathToFileURL(resolve('scripts/perf/lib/erd-app-seed.mjs')).href;
  const { buildErdLocalSeed } = (await import(seedUrl)) as {
    buildErdLocalSeed: (size: number) => Pick<ProjectionSnapshot, 'nodes' | 'edges'>;
  };
  for (const size of [200, 500]) {
    const seed = buildErdLocalSeed(size);
    const snapshot: ProjectionSnapshot = {
      ...seed,
      revision: 1,
      dictionary: { terms: [], domains: [] },
    };
    const previous = generateProjection(snapshot);
    const node = snapshot.nodes[0];
    const renamed = { ...node, data: { ...node.data, logicalTableName: '수정한 부모 😀' } };
    const next: ProjectionSnapshot = {
      ...snapshot,
      revision: 2,
      nodes: [renamed, ...snapshot.nodes.slice(1)],
    };
    const fullExpected = generateProjection(next);
    let full: DslProjection = previous;
    const fullTiming = measure(() => {
      full = generateProjection(next);
    });
    let incremental: DslProjection = previous;
    const incrementalTiming = measure(() => {
      incremental = updateProjection(previous, snapshot, next);
      diffProjection(previous, incremental);
    });
    assert.equal(full.text, fullExpected.text);
    assert.deepEqual(incremental, fullExpected);
    console.log(
      `DSL block S${size}: full p50=${fullTiming.p50.toFixed(3)}ms p95=${fullTiming.p95.toFixed(3)}ms; incremental (dependency + generation + diff, parent rename) p50=${incrementalTiming.p50.toFixed(3)}ms p95=${incrementalTiming.p95.toFixed(3)}ms`,
    );
  }
});
