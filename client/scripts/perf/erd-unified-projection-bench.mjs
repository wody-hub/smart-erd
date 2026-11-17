#!/usr/bin/env node
// 내부 플래그 읽기 전용 DSL 투영 패널의 반영 지연을 측정한다.
// 사용: VITE_ERD_UNIFIED_EDIT_MODE=internal VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS=all VITE_ERD_PERF_PROBE=true 로 빌드한 번들을 4502에 서빙한 뒤
//   node scripts/perf/erd-unified-projection-bench.mjs --sizes 200,500 --iterations 60 --out result.json [--edit]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { buildErdLocalSeed } from './lib/erd-app-seed.mjs';
import { loadDiagramHelpers, resolveChromiumPath } from './lib/erd-collab-system.mjs';

/** 명령행 옵션을 읽는다. */
function parseArgs(argv) {
  const options = {
    edit: false,
    sizes: [200, 500],
    iterations: 60,
    pace: 250,
    baseUrl: 'http://localhost:4502',
    apiUrl: 'http://localhost:9502/api',
    out: '',
  };
  for (let index = 0; index < argv.length; index += 2) {
    const [key, value] = [argv[index], argv[index + 1]];
    if (key === '--edit') {
      options.edit = true;
      index--;
      continue;
    }
    if (key === '--sizes') options.sizes = value.split(',').map(Number);
    else if (key === '--iterations') options.iterations = Number(value);
    else if (key === '--pace') options.pace = Number(value);
    else if (key === '--base-url') options.baseUrl = value;
    else if (key === '--api-url') options.apiUrl = value;
    else if (key === '--out') options.out = value;
    else throw new Error(`Unknown option ${key}`);
  }
  return options;
}

/** p50/p95/max를 계산한다. */
function summarize(values) {
  if (!values.length) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
  return {
    n: sorted.length,
    p50: Number(at(0.5).toFixed(2)),
    p95: Number(at(0.95).toFixed(2)),
    max: Number(sorted.at(-1).toFixed(2)),
  };
}

/**
 * 소유자의 통합 패널 입력부터 문서 적용·동료 패널·캔버스 표시까지 측정한다.
 * idle/최소 간격 대기는 최종 파싱 시작까지의 debounceMs로 별도 보고한다.
 * @param {import('playwright').Page} owner 소유자 페이지
 * @param {import('playwright').Page} peer 동료 페이지
 * @param {number} iterations 반복 횟수
 * @param {number} size 테이블 수
 * @returns {Promise<object>} 입력 대기와 처리·전파 지연 통계
 */
async function measureOwnerEditing(owner, peer, iterations, size) {
  const applied = [],
    panels = [],
    canvases = [],
    debounce = [],
    total = [],
    parseDebounce = [];
  const misses = [];
  for (const page of [owner, peer])
    await page.evaluate(() => {
      window.__editHits = {};
      window.__editMarker = null;
      const capture = () => {
        const marker = window.__editMarker;
        if (!marker) return;
        const record = (window.__editHits[marker] ??= {});
        const epoch = performance.timeOrigin + performance.now();
        if (
          !record.panel &&
          window.__ERD_PROJECTION_EDITOR__.getModel().getValue().includes(marker)
        )
          record.panel = epoch;
        if (
          !record.canvas &&
          [...document.querySelectorAll('.react-flow__node')].some((node) =>
            node.textContent.includes(marker),
          )
        )
          record.canvas = epoch;
      };
      window.__ERD_PROJECTION_EDITOR__.getModel().onDidChangeContent(() => {
        if (window.__editRecording)
          window.__editLastInputAt = performance.timeOrigin + performance.now();
        capture();
      });
      new MutationObserver(capture).observe(document.querySelector('.react-flow'), {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
  for (let index = 0; index < iterations; index++) {
    const marker = `edit_${size}_${index}`;
    await peer.evaluate((value) => {
      window.__editMarker = value;
    }, marker);
    await owner.evaluate((value) => {
      window.__editMarker = value;
      window.__editRecording = true;
      const editor = window.__ERD_PROJECTION_EDITOR__,
        model = editor.getModel();
      const lineNumber = model.getLinesContent().findIndex((line) => /^\s+.* ::/.test(line)) + 1;
      if (!lineNumber) throw new Error('Owner column line missing');
      const line = model.getLineContent(lineNumber);
      const startColumn = line.search(/\S/) + 1,
        endColumn = line.indexOf(' ::') + 1;
      editor.focus();
      editor.setSelection({
        selectionStartLineNumber: lineNumber,
        selectionStartColumn: startColumn,
        positionLineNumber: lineNumber,
        positionColumn: endColumn,
      });
    }, marker);
    await owner.keyboard.insertText(marker);
    await owner.evaluate(() => {
      window.__editRecording = false;
    });
    let own, remote;
    try {
      await owner.waitForFunction(
        () => {
          const lastInput = window.__editLastInputAt;
          return window
            .__ERD_PERF_SNAPSHOT__?.()
            .events.some(
              (event) => event.type === 'code-block-applied' && event.detail?.epochMs >= lastInput,
            );
        },
        null,
        { timeout: 15000 },
      );
      await peer.waitForFunction(
        (value) => Boolean(window.__editHits[value]?.panel && window.__editHits[value]?.canvas),
        marker,
        { timeout: 15000 },
      );
      own = await owner.evaluate(() => {
        const events = window.__ERD_PERF_SNAPSHOT__().events;
        const lastInput = window.__editLastInputAt;
        const applied = events.find(
          (event) => event.type === 'code-block-applied' && event.detail?.epochMs >= lastInput,
        );
        const parsed = events.find(
          (event) => event.type === 'code-block-parse' && event.detail?.epochMs >= lastInput,
        );
        return {
          lastInput: applied.detail.inputEpochMs,
          applied: applied.detail,
          parseDebounce: parsed.detail.epochMs - applied.detail.inputEpochMs,
        };
      });
      remote = await peer.evaluate((value) => window.__editHits[value], marker);
    } catch {
      misses.push(marker);
      continue;
    }
    const wait = own.applied.debounceMs;
    debounce.push(wait);
    parseDebounce.push(own.parseDebounce);
    total.push(own.applied.epochMs - own.lastInput);
    applied.push(own.applied.epochMs - own.lastInput - wait);
    panels.push(remote.panel - own.lastInput - wait);
    canvases.push(remote.canvas - own.lastInput - wait);
  }
  return {
    iterations,
    misses: misses.length,
    parseDebounceMs: summarize(parseDebounce),
    commitWaitMs: summarize(debounce),
    lastInputToOwnerAppliedIncludingWaitMs: summarize(total),
    ownerAppliedExcludingWaitMs: summarize(applied),
    peerPanelExcludingWaitMs: summarize(panels),
    peerCanvasExcludingWaitMs: summarize(canvases),
  };
}

const options = parseArgs(process.argv.slice(2));
const helpers = await loadDiagramHelpers();
const frontend = new URL(options.baseUrl);
const backend = new URL(options.apiUrl);
const config = {
  baseUrl: options.baseUrl,
  apiBaseUrl: options.apiUrl,
  frontendHost: frontend.hostname,
  frontendPort: Number(frontend.port),
  backendHost: backend.hostname,
  backendPort: Number(backend.port),
};
const browser = await chromium.launch({
  executablePath: resolveChromiumPath(undefined),
  headless: true,
});
const report = { generatedAt: new Date().toISOString(), options, results: [] };

for (const size of options.sizes) {
  const fixture = await helpers.provisionCollaborationFixture(config, {
    diagramName: `proj bench S${size}`,
  });
  const target = fixture.target;
  const apiPath = `${options.apiUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`;
  const open = async (probe) => {
    const context = await browser.newContext({
      viewport: { width: 2200, height: 1680 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    if (probe)
      await page.addInitScript(() => {
        window.__ERD_PERF_PROBE_ENABLE__ = true;
      });
    const token = await helpers.loginViaUi(page, { ...config, ...fixture });
    return { context, page, token };
  };
  const owner = await open(options.edit);
  const peer = await open(true);
  const seed = buildErdLocalSeed(size);
  seed.nodes.forEach((node, index) => {
    node.position = index === 0 ? { x: 0, y: 0 } : { x: node.position.x, y: node.position.y + 600 };
  });
  await fetch(apiPath, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${owner.token}`,
      'Content-Type': 'application/json',
      'X-Smart-Erd-Client-Protocol': '3',
    },
    body: JSON.stringify({
      content: JSON.stringify({ nodes: seed.nodes, edges: seed.edges, groups: [] }),
    }),
  });
  const url = helpers.diagramUrl(config, target);
  await owner.page.goto(url, { waitUntil: 'domcontentloaded' });
  await helpers.waitForEditableDiagram(owner.page, 60000);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const detail = await (
      await fetch(apiPath, { headers: { Authorization: `Bearer ${owner.token}` } })
    ).json();
    if (detail.hasYdocSnapshot && detail.snapshotRevision === detail.contentRevision) break;
    await delay(250);
  }
  await peer.page.goto(url, { waitUntil: 'domcontentloaded' });
  await helpers.waitForEditableDiagram(peer.page, 60000);
  await peer.page.waitForSelector('[data-testid="dsl-live-projection"][data-status="ready"]', {
    timeout: 60000,
  });
  // Monaco는 지연 로드되므로 에디터가 노출될 때까지 기다린다.
  await peer.page.waitForFunction(() => Boolean(window.__ERD_PROJECTION_EDITOR__), null, {
    timeout: 60000,
  });
  const hydrateText = await peer.page.evaluate(
    () => window.__ERD_PROJECTION_EDITOR__.getModel().getValue().length,
  );
  await peer.page.evaluate(() => {
    const model = window.__ERD_PROJECTION_EDITOR__.getModel();
    window.__projHits = {};
    window.__projMarker = null;
    model.onDidChangeContent(() => {
      const marker = window.__projMarker;
      if (marker && !(marker in window.__projHits) && model.getValue().includes(marker))
        window.__projHits[marker] = performance.timeOrigin + performance.now();
    });
  });
  if (options.edit) {
    await owner.page.waitForFunction(() => Boolean(window.__ERD_PROJECTION_EDITOR__));
    for (const page of [owner.page, peer.page])
      await page
        .locator('#diagram-sidebar span[title$="(tbl_0)"], #diagram-sidebar span[title="tbl_0"]')
        .click();
    await delay(400);
    const measurements = await measureOwnerEditing(owner.page, peer.page, options.iterations, size);
    report.results.push({ size, mode: 'edit', hydrateTextLength: hydrateText, ...measurements });
    await owner.context.close();
    await peer.context.close();
    continue;
  }
  // 첫 테이블을 화면에 두고 편집 모드로 전환한다.
  await owner.page
    .locator('#diagram-sidebar span[title$="(tbl_0)"], #diagram-sidebar span[title="tbl_0"]')
    .click();
  await delay(400);
  const node = owner.page.locator('.react-flow__node[data-id="t0"]');
  await node
    .locator('[data-table-node-kind="persisted"] > div')
    .first()
    .click({ position: { x: 5, y: 5 } });
  const input = node.getByRole('textbox', { name: /^(컬럼 이름|Column name)$/ }).first();
  await input.waitFor({ state: 'visible' });

  const latencies = [];
  const misses = [];
  for (let index = 0; index < options.iterations; index += 1) {
    const marker = `rn_${size}_${index}`;
    await peer.page.evaluate((value) => {
      window.__projMarker = value;
    }, marker);
    const startedAt = await owner.page.evaluate(() => performance.timeOrigin + performance.now());
    await input.fill(marker);
    await input.press('Tab');
    let hit = null;
    for (let wait = 0; wait < 80 && hit === null; wait += 1) {
      hit = await peer.page.evaluate((value) => window.__projHits[value] ?? null, marker);
      if (hit === null) await delay(25);
    }
    if (hit === null) misses.push(marker);
    else latencies.push(hit - startedAt);
    await delay(options.pace);
    // 다음 반복을 위해 입력창 포커스를 되돌린다.
    await input.click();
  }
  const probe = await peer.page.evaluate(() => {
    const snapshot = window.__ERD_PERF_SNAPSHOT__?.();
    if (!snapshot) return null;
    const durations = snapshot.events
      .filter((e) => e.type === 'projection-patch-applied')
      .map((e) => e.detail?.durationMs)
      .filter((v) => typeof v === 'number');
    return { durations, counters: snapshot.counters ?? null };
  });
  const maxLongTask = await peer.page.evaluate(() =>
    performance.getEntriesByType('longtask').reduce((sum, t) => sum + t.duration, 0),
  );
  report.results.push({
    size,
    hydrateTextLength: hydrateText,
    iterations: options.iterations,
    misses: misses.length,
    ownerInputToPanelMs: summarize(latencies),
    eventToMonacoAppliedMs: summarize(probe?.durations ?? []),
    probeEnabled: probe !== null,
    peerLongTaskTotalMs: Math.round(maxLongTask),
  });
  await owner.context.close();
  await peer.context.close();
}

await browser.close();
const text = JSON.stringify(report, null, 2);
if (options.out) {
  await mkdir(dirname(resolve(options.out)), { recursive: true });
  await writeFile(resolve(options.out), text);
}
console.log(text);
