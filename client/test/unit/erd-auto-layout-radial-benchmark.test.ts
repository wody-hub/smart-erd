import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyErdLayout } from '../../src/lib/auto-layout.js';
import { buildScaledGraph, type TestGraph } from '../fixtures/erd-auto-layout-graphs.js';
import { buildAnonymizedRealDiagram } from '../fixtures/erd-auto-layout-real-diagram.js';

/** 벤치 대상 규모별 설정. 예산은 CI 변동을 감안한 느슨한 상한이며 실측값은 출력으로 남긴다. */
const BENCHMARK_CASES: Array<{
  name: string;
  build: () => TestGraph;
  warmup: number;
  samples: number;
  p95BudgetMs: number;
}> = [
  {
    name: '37 nodes (real diagram)',
    build: buildAnonymizedRealDiagram,
    warmup: 5,
    samples: 30,
    p95BudgetMs: 250,
  },
  {
    name: '100 nodes',
    build: () => buildScaledGraph(100),
    warmup: 3,
    samples: 15,
    p95BudgetMs: 600,
  },
  {
    name: '500 nodes',
    build: () => buildScaledGraph(500),
    warmup: 1,
    samples: 5,
    p95BudgetMs: 3_000,
  },
];

/** 정렬 시간 표본의 백분위수를 구한다. */
function percentile(samples: number[], ratio: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

for (const { name, build, warmup, samples, p95BudgetMs } of BENCHMARK_CASES) {
  test(`radial applyErdLayout benchmark: ${name} stays within the p95 budget`, async () => {
    const graph = build();
    for (let index = 0; index < warmup; index += 1) {
      await applyErdLayout(graph.nodes, graph.edges, { strategy: 'radial' });
    }

    const durations: number[] = [];
    const heapBefore = process.memoryUsage().heapUsed;
    for (let index = 0; index < samples; index += 1) {
      const start = performance.now();
      const result = await applyErdLayout(graph.nodes, graph.edges, { strategy: 'radial' });
      durations.push(performance.now() - start);
      assert.equal(result.status, 'applied');
    }
    const heapGrowthMb = (process.memoryUsage().heapUsed - heapBefore) / 1_000_000;

    const p50 = percentile(durations, 0.5);
    const p95 = percentile(durations, 0.95);
    console.log(
      `# radial layout ${name}: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms (${samples} samples), heap growth ${heapGrowthMb.toFixed(1)} MB`,
    );
    assert.ok(p95 <= p95BudgetMs, `p95 ${p95.toFixed(1)} ms exceeds ${p95BudgetMs} ms`);
  });
}
