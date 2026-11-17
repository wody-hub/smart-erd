import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DiagramLiveProjectionSlot from '../../src/components/erd/DiagramLiveProjectionSlot.js';
import { resolveErdUnifiedEditRollout } from '../../src/lib/erd-unified-edit-rollout.js';

test('off path renders no panel and does not access the projection source', () => {
  let accesses = 0;
  const runtime = {
    ready: true,
    generation: 1,
    get source(): never {
      accesses++;
      throw new Error('off must not create a port');
    },
  };
  const html = renderToStaticMarkup(
    createElement(DiagramLiveProjectionSlot, {
      enabled: resolveErdUnifiedEditRollout('42', {}) === 'internal',
      diagramId: '42',
      runtime,
    }),
  );
  assert.equal(html, '');
  assert.equal(accesses, 0);
});

test('DiagramPage forces erd only for internal rollout before deriving capabilities', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/pages/diagram/DiagramPage.tsx', 'utf8');
  assert.match(
    source,
    /useDiagramWorkModeState\(\{\s*forcedMode: unifiedProjectionEnabled \? 'erd' : undefined/,
  );
});

test('internal ignores saved code mode without reading or writing the saved preference', async () => {
  const { sourceHookHarness } = await import('../helpers/source-hook-harness.js');
  let reads = 0;
  let writes = 0;
  const harness = sourceHookHarness('src/pages/diagram/use-diagram-work-mode-state.ts', {
    'diagram-work-mode': {
      DEFAULT_DIAGRAM_WORK_MODE: 'erd',
      loadDiagramWorkMode: () => {
        reads++;
        return 'code';
      },
      saveDiagramWorkMode: () => {
        writes++;
      },
    },
  });
  const hook = harness.exports.useDiagramWorkModeState as (args: {
    teamId: string;
    projectId: string;
    diagramId: string;
    forcedMode?: 'erd';
  }) => { workMode: string };
  for (let i = 0; i < 2; i++) {
    const result = harness.render(() =>
      hook({ teamId: 't', projectId: 'p', diagramId: 'd', forcedMode: 'erd' }),
    );
    assert.equal(result.workMode, 'erd');
    harness.runEffects();
  }
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  harness.cleanup();
});

test('off preserves the existing saved work-mode load and persistence path', async () => {
  const { sourceHookHarness } = await import('../helpers/source-hook-harness.js');
  let saved: unknown;
  const harness = sourceHookHarness('src/pages/diagram/use-diagram-work-mode-state.ts', {
    'diagram-work-mode': {
      DEFAULT_DIAGRAM_WORK_MODE: 'erd',
      loadDiagramWorkMode: () => 'code',
      saveDiagramWorkMode: (_scope: unknown, mode: unknown) => {
        saved = mode;
      },
    },
  });
  const hook = harness.exports.useDiagramWorkModeState as (args: {
    teamId: string;
    projectId: string;
    diagramId: string;
  }) => { workMode: string };
  const args = { teamId: 't', projectId: 'p', diagramId: 'd' };
  harness.render(() => hook(args));
  harness.runEffects();
  assert.equal(harness.render(() => hook(args)).workMode, 'code');
  harness.runEffects();
  assert.equal(saved, 'code');
  harness.cleanup();
});
