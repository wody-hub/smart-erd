import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

/** 브라우저 없이 기존 probe의 이중 플래그와 User Timing 출력을 검사한다. */
function probeHarness(buildEnabled: boolean, runtimeEnabled: boolean) {
  let now = 0;
  const marks: string[] = [];
  const window: Record<string, unknown> = {
    __ERD_PERF_PROBE_ENABLE__: runtimeEnabled,
    addEventListener: () => {},
  };
  const module = { exports: {} as Record<string, (...args: number[]) => void> };
  const source = readFileSync('src/lib/erd-performance-probe.ts', 'utf8').replaceAll(
    'import.meta.env',
    'env',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    module,
    exports: module.exports,
    window,
    env: { VITE_ERD_PERF_PROBE: String(buildEnabled) },
    performance: { now: () => now, mark: (name: string) => marks.push(name) },
    requestAnimationFrame: () => 0,
    structuredClone,
  });
  return {
    api: module.exports,
    window,
    marks,
    time: (value: number) => {
      now = value;
    },
  };
}

test('projection timing stays disabled unless both existing perf flags are enabled', () => {
  for (const flags of [
    [false, true],
    [true, false],
    [false, false],
  ]) {
    const h = probeHarness(flags[0], flags[1]);
    h.api.probeSetNavigationOrigin();
    h.api.probeProjectionPatchApplied(0, 1, 2);
    assert.equal(h.window.__ERD_PERF_SNAPSHOT__, undefined);
    assert.equal(h.marks.length, 0);
  }
});

test('enabled projection mark records event-to-Monaco duration and deleted-target count', () => {
  const h = probeHarness(true, true);
  h.api.probeSetNavigationOrigin();
  h.time(26);
  h.api.probeProjectionPatchApplied(10, 7, 2);
  const snapshot = (
    h.window.__ERD_PERF_SNAPSHOT__ as () => {
      events: { type: string; detail?: { durationMs: number; revision: number } }[];
      counters: Record<string, { calls: number; maxMs: number }>;
    }
  )();
  const event = snapshot.events.find((entry) => entry.type === 'projection-patch-applied');
  assert.equal(event?.detail?.durationMs, 16);
  assert.equal(event?.detail?.revision, 7);
  assert.equal(snapshot.counters['projection-patch-applied'].maxMs, 16);
  assert.equal(snapshot.counters['projection-deleted-target-relocations'].calls, 2);
  assert.ok(h.marks.includes('erdperf:projection-patch-applied'));
});
