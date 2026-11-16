#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { buildErdLocalSeed } from './lib/erd-app-seed.mjs';
import { summarizeCpuProfile } from './lib/erd-cpu-profile.mjs';
import { installCollabProbe } from './lib/erd-collab-probe.mjs';
import {
  commitHash,
  loadDiagramHelpers,
  resolveChromiumPath,
  startServerSampler,
  summarize,
} from './lib/erd-collab-system.mjs';

/** 허용되는 측정 시나리오. */
const SCENARIOS = ['C1', 'C2', 'C3', 'C4'];
/** 보고서에 항상 포함하는 해석상의 한계. */
const LIMITATIONS = [
  '같은 머신에서 K개 헤드리스 컨텍스트와 백엔드가 CPU를 공유한다. 절대 성능 보장이 아닌 상대 비교용이다.',
  'DOM 반영 시각이며 픽셀 표시/네트워크 단독 지연이 아니다. React 개발 빌드와 관찰기 비용을 포함한다.',
  'MutationObserver를 우선 사용하되 input.value property 변경은 rAF로 보조 관찰한다. 샘플별 source를 확인한다.',
  '동시 입력은 독립 페이지에 Promise.all로 발행한다. 실제 입력 시각 차이는 C3 dispatchSkewMs에 기록한다.',
  'ps CPU%는 운영체제의 프로세스 평균 정의를 따른다. 전용 측정 구간 CPU 사용률과 같지 않을 수 있다.',
  '동일 계정은 앱의 사용자 단위 soft lock에서 제외된다. 서로 다른 계정의 락 동작은 측정하지 않는다.',
  'UI role/aria-label, React Flow class, 컬럼 행/handle 구조와 드래그 좌표에 의존한다.',
];
/** 보관할 브라우저 오류의 최대 개수. */
const MAX_PAGE_ERRORS = 50;

/**
 * CLI 옵션을 엄격히 검증한다.
 * @param {string[]} args CLI 인자
 * @returns {object} 정규화한 옵션
 */
function parseOptions(args) {
  const accepted = new Set([
    'scenarios',
    'clients',
    'duration-s',
    'rate',
    'seed-size',
    'iterations',
    'out',
    'chromium-path',
    'base-url',
    'api-url',
    'timeout-ms',
    'profile',
    'help',
  ]);
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !accepted.has(key))
      throw new Error(`Unknown option: ${args[i]}`);
    if (key === 'help' || key === 'profile') values[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
      values[key] = value;
    }
  }
  /** 지정 범위의 유한 숫자를 읽는다. */
  const numeric = (key, fallback, min, max, integer = false) => {
    const value = Number(values[key] ?? fallback);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      throw new Error(
        `--${key} must be ${integer ? 'an integer' : 'a number'} in [${min}, ${max}]`,
      );
    }
    return value;
  };
  const scenarios = [...new Set((values.scenarios ?? 'C1,C2,C3,C4').split(','))];
  if (scenarios.some((scenario) => !SCENARIOS.includes(scenario)))
    throw new Error('Use C1,C2,C3,C4');
  const sizes = [
    ...new Set(
      (values['seed-size'] ?? '10').split(',').map((size) => Number(size.replace(/^S/, ''))),
    ),
  ];
  if (sizes.some((size) => ![10, 50, 200, 500].includes(size)))
    throw new Error('Use seed sizes 10,50,200,500');
  const clients = numeric('clients', 2, 2, 16, true);
  if (sizes.some((size) => size < clients)) throw new Error('--clients must not exceed seed size');
  const options = {
    ...values,
    scenarios,
    sizes,
    clients,
    durationS: numeric('duration-s', 5, 0.1, 3600),
    rate: numeric('rate', 1, 0.1, 50),
    iterations: numeric('iterations', 3, 1, 1000, true),
    timeoutMs: numeric('timeout-ms', 5000, 500, 60000, true),
    baseUrl: (values['base-url'] ?? 'http://localhost:4502').replace(/\/$/, ''),
    apiUrl: (values['api-url'] ?? 'http://localhost:9502/api').replace(/\/$/, ''),
    out: resolve(values.out ?? './perf-reports/erd-collab-baseline.json'),
  };
  if (options.durationS * options.rate * clients > 20000)
    throw new Error('Limit is 20000 edits per scenario');
  for (const url of [options.baseUrl, options.apiUrl]) {
    const parsed = new URL(url);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
      throw new Error('Local endpoints only');
    if (parsed.username || parsed.password)
      throw new Error('Endpoint URLs must not contain credentials');
  }
  if (!options.out.endsWith('.json')) throw new Error('--out must end in .json');
  return options;
}

/**
 * API 호출 실패에 토큰/응답 본문을 포함하지 않는다.
 * @param {string} url 요청 URL
 * @param {string} token 인증 토큰
 * @param {string} method HTTP method
 * @param {object|undefined} body 요청 본문
 * @returns {Promise<object>} JSON 응답
 */
async function api(url, token, method = 'GET', body = undefined) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`API ${method} ${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}

/**
 * 오류 메시지를 제한 길이로 정리하고 원문 스택/인증정보는 저장하지 않는다.
 * @param {unknown} error 오류
 * @returns {string} 보고서용 메시지
 */
function errorMessage(error) {
  const lines = String(error?.message ?? error).split('\n');
  const diagnostic = lines
    .filter((line) => /signal=|kill EPERM|spawn EPERM|ERROR:|Operation not permitted/.test(line))
    .slice(0, 3);
  return [...lines.slice(0, 3), ...diagnostic]
    .join(' ')
    .replaceAll('\u001b[2m', '')
    .replaceAll('\u001b[22m', '')
    .replace(/E2E-\d{13}-[a-z0-9]+/g, '[redacted]')
    .slice(0, 1800);
}

/**
 * DOM 테이블 노드 locator를 반환한다.
 * @param {object} page Playwright Page
 * @param {string} id 테이블 ID
 * @returns {object} Locator
 */
function tableNode(page, id) {
  return page.locator(`.react-flow__node[data-id="${id}"]`);
}

/**
 * 물리 컬럼 이름 input을 찾는다.
 * @param {object} page Page
 * @param {string} table 테이블 ID
 * @param {number} index 컬럼 순번
 * @returns {object} Locator
 */
function columnInput(page, table, index = 0) {
  return tableNode(page, table)
    .getByRole('textbox', { name: /^(컬럼 이름|Column name)$/ })
    .nth(index);
}

/**
 * 테이블 헤더를 실제 클릭해 편집 모드로 전환한다.
 * @param {object} page Page
 * @param {string} table 테이블 ID
 * @returns {Promise<void>}
 */
async function selectTable(page, table) {
  const header = tableNode(page, table).locator('[data-table-node-kind="persisted"] > div').first();
  await header.click({ position: { x: 5, y: 5 } });
  await columnInput(page, table).waitFor({ state: 'visible' });
  if (!(await columnInput(page, table).isEditable()))
    throw new Error(`Table ${table} is not editable`);
}

/**
 * 첫 K 테이블을 모두 볼 수 있도록 기존 sidebar 포커스와 마우스 pan을 사용한다.
 * @param {object} page Page
 * @returns {Promise<void>}
 */
async function focusWorkbench(page) {
  await page
    .locator('#diagram-sidebar span[title$="(tbl_0)"], #diagram-sidebar span[title="tbl_0"]')
    .click();
  // sidebar setCenter 애니메이션(300ms)이 끝난 후 좌표를 읽는다.
  await delay(330);
  const pane = await page.locator('.react-flow').boundingBox();
  const node = await tableNode(page, 't0').boundingBox();
  if (!pane || !node) throw new Error('Workbench DOM not rendered');
  const dx = pane.x + 60 - node.x;
  const dy = pane.y + 70 - node.y;
  await page.mouse.move(pane.x + 20, pane.y + 20);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(pane.x + 20 + dx, pane.y + 20 + dy, { steps: 2 });
  await page.mouse.up({ button: 'middle' });
}

/**
 * 독립 컨텍스트를 만들고 UI로 동일 계정 로그인한다.
 * @param {object} session 실행 세션
 * @returns {Promise<object>} page/cdp/context와 CDP 누적 계측
 */
async function loginClient(session) {
  const context = await session.browser.newContext({
    viewport: session.viewport,
    deviceScaleFactor: 1,
  });
  session.contexts.add(context);
  const page = await context.newPage();
  page.setDefaultTimeout(session.options.timeoutMs);
  page.setDefaultNavigationTimeout(15000);
  await page.addInitScript(installCollabProbe);
  if (session.options.profile)
    await page.addInitScript(() => {
      window.__ERD_PERF_PROBE_ENABLE__ = true;
    });
  const client = {
    context,
    page,
    cdp: await context.newCDPSession(page),
    ws: null,
    heap: [],
    pageErrors: [],
  };
  session.allClients.push(client);
  page.on('pageerror', (error) => {
    if (client.pageErrors.length < MAX_PAGE_ERRORS) client.pageErrors.push(errorMessage(error));
  });
  await client.cdp.send('Network.enable');
  await client.cdp.send('Performance.enable');
  for (const [event, direction] of [
    ['Network.webSocketFrameSent', 'sent'],
    ['Network.webSocketFrameReceived', 'received'],
  ]) {
    client.cdp.on(event, ({ response }) => {
      if (!client.ws) return;
      client.ws[`${direction}Frames`] += 1;
      client.ws[`${direction}Bytes`] +=
        response.opcode === 1
          ? Buffer.byteLength(response.payloadData)
          : Buffer.from(response.payloadData, 'base64').length;
    });
  }
  client.token = await session.helpers.loginViaUi(page, { ...session.config, ...session.fixture });
  return client;
}

/**
 * 로그인한 클라이언트가 다이어그램 편집 가능 상태에 도달할 때까지 기다린다.
 * @param {object} session 세션
 * @param {object} client 로그인된 클라이언트
 * @returns {Promise<object>} 접속 지연
 */
async function joinDiagram(session, client) {
  const startedAt = await client.page.evaluate(() => performance.timeOrigin + performance.now());
  await client.page.goto(session.helpers.diagramUrl(session.config, session.fixture.target), {
    waitUntil: 'domcontentloaded',
  });
  await session.helpers.waitForEditableDiagram(client.page, 15000);
  await client.page.waitForFunction(
    () => window.__collabBench.tableState('t0')?.columns.length > 0,
  );
  const readyAt = await client.page.evaluate(() => window.__collabBench.readyAt());
  if (readyAt === null) throw new Error('Editable DOM readiness timestamp missing');
  return { startedAt, readyAt, editableMs: readyAt - startedAt };
}

/**
 * 시나리오별 전용 fixture를 만들고 content-only→앱 부트스트랩으로 snapshot을 검증한다.
 * @param {object} session 세션
 * @param {number} size 테이블 수
 * @returns {Promise<void>}
 */
async function prepare(session, size) {
  session.fixture = await session.helpers.provisionCollaborationFixture(session.config, {
    diagramName: `Collab perf S${size}`,
  });
  const owner = await loginClient(session);
  session.clients.push(owner);
  const target = session.fixture.target;
  session.apiPath = `${session.config.apiBaseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`;
  const seed = buildErdLocalSeed(size);
  const columns = Math.ceil(Math.sqrt(session.options.clients));
  const rows = Math.ceil(session.options.clients / columns);
  // 첫 K 테이블은 공통 측정 영역에 배치하고 나머지는 원래 격자 형태를 보존한다.
  seed.nodes.forEach((node, index) => {
    node.position =
      index < session.options.clients
        ? { x: (index % columns) * 720, y: Math.floor(index / columns) * 600 }
        : { x: node.position.x, y: node.position.y + rows * 600 };
  });
  const content = JSON.stringify({ nodes: seed.nodes, edges: seed.edges, groups: [] });
  await api(session.apiPath, owner.token, 'PUT', { content });
  await joinDiagram(session, owner);
  const deadline = Date.now() + 10000;
  let detail;
  do {
    detail = await api(session.apiPath, owner.token);
    if (detail.hasYdocSnapshot && detail.snapshotRevision === detail.contentRevision) break;
    await delay(100);
  } while (Date.now() < deadline);
  if (!detail.hasYdocSnapshot || detail.snapshotRevision !== detail.contentRevision) {
    throw new Error('Seed snapshot was not persisted at content revision');
  }
  const saved = JSON.parse(detail.content);
  if (JSON.stringify(saved) !== content)
    throw new Error('Persisted seed content differs from input');
  session.result.fixture = {
    target,
    seed: seed.meta,
    contentRevision: detail.contentRevision,
    snapshotRevision: detail.snapshotRevision,
    snapshotVerified: true,
  };
  for (let i = 1; i < session.options.clients; i += 1) {
    const client = await loginClient(session);
    session.clients.push(client);
    await joinDiagram(session, client);
  }
  await Promise.all(
    session.clients.map(async ({ page }) => {
      await focusWorkbench(page);
      if ((await page.locator('#diagram-sidebar span[title]').count()) !== size) {
        throw new Error('Peer snapshot table count differs from seed size');
      }
      const pane = await page.locator('.react-flow').boundingBox();
      for (let i = 0; i < session.options.clients; i += 1) {
        const state = await page.evaluate((id) => window.__collabBench.tableState(id), `t${i}`);
        const box = await tableNode(page, `t${i}`).boundingBox();
        if (
          state?.columns.length !== seed.nodes[i].data.columns.length ||
          state.columns.some(
            (column, index) =>
              column.id !== seed.nodes[i].data.columns[index].id ||
              column.name !== seed.nodes[i].data.columns[index].name,
          )
        ) {
          throw new Error(
            `Measurement table t${i} columns/handles missing in DOM: got ${JSON.stringify(
              state?.columns?.slice(0, 3),
            )} (n=${state?.columns?.length}) want ${JSON.stringify(
              seed.nodes[i].data.columns.slice(0, 3).map(({ id, name }) => ({ id, name })),
            )} (n=${seed.nodes[i].data.columns.length})`,
          );
        }
        if (
          !box ||
          !pane ||
          box.x < pane.x ||
          box.y < pane.y ||
          box.x + box.width > pane.x + pane.width ||
          box.y + box.height > pane.y + pane.height
        ) {
          throw new Error(`Measurement table t${i} is outside the shared viewport`);
        }
      }
    }),
  );
}

/**
 * 모든 페이지에 같은 DOM 조건을 등록하고 작성자의 입력 이벤트를 기다린다.
 * @param {object} session 세션
 * @param {number} writer 작성자 번호
 * @param {object} spec DOM 조건
 * @param {string} event 입력 이벤트 종류
 * @returns {Promise<object>} 편집 티켓
 */
async function armEdit(session, writer, spec, event = 'input') {
  const id = `${session.key}-${session.sequence++}`;
  await Promise.all(
    session.clients.map(({ page }, index) =>
      page.evaluate(({ id, spec, event }) => window.__collabBench.arm(id, spec, event), {
        id,
        spec,
        event: index === writer ? event : null,
      }),
    ),
  );
  return { id, writer, spec };
}

/**
 * 전파 관찰 결과를 일괄 수거한다. 누락이 여러 건이어도 페이지당 한 번만 타임아웃을 기다린다.
 * @param {object} session 세션
 * @param {object[]} tickets 편집 티켓 목록
 * @returns {Promise<object[]>} 로컬/피어 지연 원시 표본
 */
async function collectEdits(session, tickets) {
  if (!tickets.length) return [];
  const ids = tickets.map((ticket) => ticket.id);
  const observations = await Promise.all(
    session.clients.map(async ({ page }, client) => {
      try {
        await page.waitForFunction(
          (ids) => ids.every((id) => window.__collabBench.read(id).seenAt !== null),
          ids,
          { timeout: session.options.timeoutMs },
        );
      } catch {
        // 어떤 편집이 누락되었는지는 아래 DOM 기록을 기준으로 보고한다.
      }
      const records = await page.evaluate(
        (ids) => ids.map((id) => window.__collabBench.read(id)),
        ids,
      );
      const missing = records.flatMap((record, index) =>
        record.seenAt === null ? [ids[index]] : [],
      );
      if (missing.length)
        session.result.errors.push({
          client,
          message: 'DOM propagation timeout',
          missingCount: missing.length,
          operations: missing.slice(0, 20),
        });
      return records;
    }),
  );
  const samples = tickets.map((ticket, index) => {
    const startedAt = observations[ticket.writer][index].startedAt;
    return {
      ...ticket,
      startedAt,
      localSource: observations[ticket.writer][index].source,
      localMs:
        ticket.spec.kind === 'move' ||
        startedAt === null ||
        observations[ticket.writer][index].seenAt === null
          ? null
          : observations[ticket.writer][index].seenAt - startedAt,
      peers: observations.flatMap((records, client) =>
        client === ticket.writer
          ? []
          : [
              {
                client,
                seenAt: records[index].seenAt,
                source: records[index].source,
                latencyMs:
                  startedAt === null || records[index].seenAt === null
                    ? null
                    : records[index].seenAt - startedAt,
              },
            ],
      ),
    };
  });
  const missingInputs = samples.filter((sample) => sample.startedAt === null);
  if (missingInputs.length)
    session.result.errors.push({
      message: 'Actual UI input event not captured',
      missingCount: missingInputs.length,
      operations: missingInputs.slice(0, 20).map((sample) => sample.id),
    });
  const early = samples.filter((sample) =>
    sample.peers.some((peer) => peer.latencyMs !== null && peer.latencyMs < 0),
  );
  if (early.length)
    session.result.errors.push({
      message: 'Peer observed before input; inspect clock/drag ordering',
      count: early.length,
      operations: early.slice(0, 20).map((sample) => sample.id),
    });
  await Promise.all(
    session.clients.map(({ page }) =>
      page.evaluate((ids) => window.__collabBench.forget(ids), ids),
    ),
  );
  session.result.samples.push(...samples);
  return samples;
}

/**
 * 단일 작성자가 네 종류의 UI 편집을 각각 M회 수행한다.
 * @param {object} session 세션
 * @returns {Promise<void>}
 */
async function runC1(session) {
  const page = session.clients[0].page;
  for (const kind of ['rename', 'column-add', 'move', 'table-add']) {
    for (let iteration = 0; iteration < session.options.iterations; iteration += 1) {
      let ticket = null;
      try {
        await selectTable(page, 't0');
        const state = await page.evaluate(() => window.__collabBench.tableState('t0'));
        if (kind === 'rename') {
          const value = `c1_${iteration}`;
          ticket = await armEdit(session, 0, { kind, table: 't0', column: 't0c0', value });
          await columnInput(page, 't0').fill(value);
        } else if (kind === 'column-add') {
          ticket = await armEdit(
            session,
            0,
            { kind, table: 't0', count: state.columns.length + 1 },
            'click',
          );
          await tableNode(page, 't0')
            .getByRole('button', { name: /^(컬럼 추가|Add Column)$/ })
            .click();
        } else if (kind === 'table-add') {
          const count = await page.locator('#diagram-sidebar span[title]').count();
          ticket = await armEdit(session, 0, { kind, count: count + 1 }, 'click');
          await page.getByRole('button', { name: /^(테이블 추가|Add table)$/i }).click();
        } else {
          const box = await tableNode(page, 't0').boundingBox();
          const scale = await page
            .locator('.react-flow__viewport')
            .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
          const dx = (iteration % 2 === 0 ? 48 : -48) * scale;
          ticket = await armEdit(
            session,
            0,
            {
              kind,
              table: 't0',
              // 드래그 시작 임계값과 격자 스냅 때문에 최종 좌표는 예측하지 않고 시작 좌표에서 바뀌었는지로 판정한다.
              from: { x: state.position.x, y: state.position.y },
            },
            'pointerup',
          );
          await page.mouse.move(box.x + 5, box.y + 5);
          await page.mouse.down();
          await page.mouse.move(box.x + 5 + dx, box.y + 5, { steps: 3 });
          await page.mouse.up();
        }
        await collectEdits(session, [ticket]);
      } catch (error) {
        session.result.errors.push({ kind, iteration, message: errorMessage(error) });
      } finally {
        if (ticket)
          await Promise.all(
            session.clients.map(({ page }) =>
              page.evaluate((id) => window.__collabBench.forget([id]), ticket.id).catch(() => {}),
            ),
          );
      }
    }
  }
}

/**
 * CDP 누적 성능 지표를 이름으로 조회하는 사전으로 바꾼다.
 * @param {object} client 클라이언트
 * @returns {Promise<object>} 이름→값
 */
async function performanceMetrics(client) {
  const { metrics } = await client.cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

/**
 * 모든 페이지의 측정을 시작하고 편집 중 힙을 1초마다 수집한다.
 * @param {object} session 세션
 * @returns {Promise<object>} stop()이 페이지별 지표를 반환한다
 */
async function startPageMetrics(session) {
  const baseline = await Promise.all(session.clients.map(performanceMetrics));
  await Promise.all(
    session.clients.map(async (client) => {
      client.ws = { sentFrames: 0, sentBytes: 0, receivedFrames: 0, receivedBytes: 0 };
      client.heap = [];
      await client.page.evaluate(() => window.__collabBench.start());
    }),
  );
  let pending = null;
  /** 모든 페이지에서 힙 표본을 수집한다. */
  async function sampleHeap() {
    await Promise.all(
      session.clients.map(async (client) => {
        const usage = await client.cdp.send('Runtime.getHeapUsage');
        client.heap.push({ at: Date.now(), usedMiB: usage.usedSize / 1048576 });
      }),
    );
  }
  await sampleHeap();
  const heapErrors = [];
  const timer = setInterval(() => {
    if (pending) return;
    pending = sampleHeap()
      .catch((error) => heapErrors.push(errorMessage(error)))
      .finally(() => {
        pending = null;
      });
  }, 1000);
  return {
    async stop() {
      clearInterval(timer);
      await pending;
      await sampleHeap();
      session.result.errors.push(...heapErrors.map((message) => ({ metric: 'heap', message })));
      return Promise.all(
        session.clients.map(async (client, index) => {
          const after = await performanceMetrics(client);
          const browser = await client.page.evaluate(() => window.__collabBench.stop());
          const websocket = { ...client.ws };
          client.ws = null;
          return {
            client: index,
            ...browser,
            cdpDeltaMs: Object.fromEntries(
              ['TaskDuration', 'ScriptDuration', 'LayoutDuration'].map((key) => [
                key,
                (after[key] - baseline[index][key]) * 1000,
              ]),
            ),
            websocket,
            jsHeapMiB: summarize(client.heap.map((sample) => sample.usedMiB)),
            heapSamples: client.heap,
          };
        }),
      );
    },
  };
}

/**
 * K명의 작성자를 고정 간격으로 실행한다. 지연된 슬롯은 건너뛰고 몰아서 보상하지 않는다.
 * @param {object} session 세션
 * @param {Function|undefined} afterFirstEdit 첫 입력 뒤 추가 측정
 * @returns {Promise<void>}
 */
async function runLoad(session, afterFirstEdit) {
  await Promise.all(session.clients.map(({ page }, index) => selectTable(page, `t${index}`)));
  const meter = await startPageMetrics(session);
  // --profile: 작성자 1번 페이지의 메인 스레드 CPU 프로파일을 편집 부하 창 동안 수집한다.
  const profiled = session.options.profile ? session.clients[1] : null;
  if (profiled) {
    await profiled.cdp.send('Profiler.enable');
    await profiled.cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    await profiled.cdp.send('Profiler.start');
  }
  // 앱 프로브(VITE_ERD_PERF_PROBE=true 빌드에서만 존재)의 카운터 변화량을 함께 기록한다.
  const readCounters = () =>
    profiled.page.evaluate(() => window.__ERD_PERF_SNAPSHOT__?.().counters ?? {});
  const countersBefore = profiled ? await readCounters() : null;
  const tickets = [];
  const startedAt = Date.now();
  const deadline = startedAt + session.options.durationS * 1000;
  const period = 1000 / session.options.rate;
  session.loadWindow = { startedAt, deadline };
  let firstResolved = false;
  let resolveFirst;
  const firstEdit = new Promise((resolvePromise) => {
    resolveFirst = resolvePromise;
  });
  const tasks = session.clients.map(async ({ page }, writer) => {
    let slot = 0;
    while (Date.now() < deadline) {
      await delay(Math.max(0, Math.min(deadline, startedAt + slot * period) - Date.now()));
      if (Date.now() >= deadline) break;
      const value = `c2_${writer}_${slot}`;
      const ticket = await armEdit(session, writer, {
        kind: 'rename',
        table: `t${writer}`,
        column: `t${writer}c0`,
        value,
      });
      tickets.push(ticket);
      await columnInput(page, `t${writer}`).fill(value);
      if (!firstResolved) {
        firstResolved = true;
        resolveFirst();
      }
      slot = Math.max(slot + 1, Math.ceil((Date.now() - startedAt) / period));
    }
  });
  const writers = Promise.allSettled(tasks);
  // 입력이 발생하기 전에 작성자가 모두 실패해도 합류 대기를 해제한다.
  const extra = afterFirstEdit
    ? Promise.race([firstEdit, writers]).then(() => {
        if (!firstResolved) throw new Error('No edit dispatched before under-load join');
        return afterFirstEdit();
      })
    : Promise.resolve();
  // 합류가 늦어져도 편집 부하와 페이지 지표 창은 duration-s에 맞춰 닫는다.
  const extraOutcome = extra.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  let writerResults;
  let endedAt;
  try {
    writerResults = await writers;
    endedAt = Date.now();
  } finally {
    session.result.pages = await meter.stop();
    if (profiled) {
      const { profile } = await profiled.cdp.send('Profiler.stop');
      await profiled.cdp.send('Profiler.disable');
      session.result.cpuProfile = summarizeCpuProfile(profile);
      const countersAfter = await readCounters();
      session.result.probeCounters = Object.fromEntries(
        Object.entries(countersAfter)
          .map(([name, value]) => {
            const prev = countersBefore[name] ?? { calls: 0, totalMs: 0 };
            return [
              name,
              { calls: value.calls - prev.calls, totalMs: value.totalMs - prev.totalMs },
            ];
          })
          .filter(([, value]) => value.calls !== 0),
      );
    }
  }
  const extraResult = await extraOutcome;
  for (const result of writerResults) {
    if (result.status === 'rejected')
      session.result.errors.push({ workload: 'C2', message: errorMessage(result.reason) });
  }
  if (extraResult.error)
    session.result.errors.push({ workload: 'C4', message: errorMessage(extraResult.error) });
  session.result.load = {
    startedAt,
    endedAt,
    requestedDurationS: session.options.durationS,
    actualWindowMs: endedAt - startedAt,
    edits: tickets.length,
    writers: session.clients.map((_, writer) => ({
      writer,
      edits: tickets.filter((ticket) => ticket.writer === writer).length,
      achievedRate:
        tickets.filter((ticket) => ticket.writer === writer).length /
        ((endedAt - startedAt) / 1000),
    })),
  };
  const samples = await collectEdits(session, tickets);
  session.result.load.attemptedEdits = tickets.length;
  session.result.load.edits = samples.filter((sample) => sample.startedAt !== null).length;
  for (const writer of session.result.load.writers) {
    writer.edits = samples.filter(
      (sample) => sample.writer === writer.writer && sample.startedAt !== null,
    ).length;
    writer.achievedRate = writer.edits / ((endedAt - startedAt) / 1000);
  }
  if (!tickets.length)
    session.result.errors.push({ workload: 'C2', message: 'No edits dispatched' });
}

/**
 * C3의 모든 페이지 DOM 값이 안정적으로 일치할 때까지 관찰한다.
 * @param {object} session 세션
 * @param {Function} predicate 상태 배열을 판정하는 함수
 * @returns {Promise<object>} 안정값, 관찰 시각, 성공 여부
 */
async function waitForConvergence(session, predicate) {
  const deadline = Date.now() + session.options.timeoutMs;
  let stableSince = null;
  let signature = null;
  let states = [];
  let convergedAt = null;
  do {
    states = await Promise.all(
      session.clients.map(({ page }) =>
        page.evaluate(() => ({
          at: window.__collabBench.clock(),
          state: window.__collabBench.tableState('t0'),
        })),
      ),
    );
    const next = JSON.stringify(states.map(({ state }) => state?.columns));
    if (predicate(states.map(({ state }) => state))) {
      if (next !== signature) {
        stableSince = Date.now();
        convergedAt = Math.max(...states.map(({ at }) => at));
      }
      if (Date.now() - stableSince >= 300)
        return { pass: true, states, convergedAt, stableForMs: 300 };
    } else stableSince = null;
    signature = stableSince === null ? null : next;
    await delay(25);
  } while (Date.now() < deadline);
  return { pass: false, states, convergedAt: null, stableForMs: 0 };
}

/**
 * 같은 컬럼의 경합 및 같은 테이블의 서로 다른 컬럼 추가 손실을 검사한다.
 * @param {object} session 세션
 * @returns {Promise<void>}
 */
async function runC3(session) {
  await Promise.all(session.clients.map(({ page }) => selectTable(page, 't0')));
  const values = session.clients.map((_, index) => `conflict_${index}`);
  const ids = session.clients.map((_, index) => `conflict-${index}`);
  await Promise.all(
    session.clients.map(({ page }, index) =>
      page.evaluate(
        ({ id, value }) =>
          window.__collabBench.arm(
            id,
            { kind: 'rename', table: 't0', column: 't0c0', value },
            'input',
          ),
        { id: ids[index], value: values[index] },
      ),
    ),
  );
  const outcomes = await Promise.allSettled(
    session.clients.map(({ page }, index) => columnInput(page, 't0').fill(values[index])),
  );
  const dispatched = await Promise.all(
    session.clients.map(({ page }, index) =>
      page.evaluate((id) => window.__collabBench.read(id).startedAt, ids[index]),
    ),
  );
  const validInputs =
    outcomes.every((outcome) => outcome.status === 'fulfilled') &&
    dispatched.every(Number.isFinite);
  const rename = await waitForConvergence(session, (states) => {
    const names = states.map(
      (state) => state?.columns.find((column) => column.id === 't0c0')?.name,
    );
    return validInputs && values.includes(names[0]) && names.every((name) => name === names[0]);
  });
  session.result.convergence = [
    {
      check: 'same-column-rename',
      status: rename.pass ? 'PASS' : 'FAIL',
      pass: rename.pass,
      submittedValues: values,
      inputTimes: dispatched,
      dispatchSkewMs: validInputs ? Math.max(...dispatched) - Math.min(...dispatched) : null,
      convergenceMs: rename.pass ? rename.convergedAt - Math.min(...dispatched) : null,
      finalValues: rename.states.map(
        ({ state }) => state?.columns.find((column) => column.id === 't0c0')?.name ?? null,
      ),
      stableForMs: rename.stableForMs,
    },
  ];
  await Promise.all(
    session.clients.map(({ page }, index) =>
      page.evaluate((id) => window.__collabBench.forget([id]), ids[index]),
    ),
  );
  const before = rename.states[0]?.state?.columns.map((column) => column.id) ?? [];
  const addIds = session.clients.map((_, index) => `add-conflict-${index}`);
  await Promise.all(
    session.clients.map(({ page }, index) =>
      page.evaluate(
        (id) =>
          window.__collabBench.arm(
            id,
            { kind: 'column-add', table: 't0', count: Number.MAX_SAFE_INTEGER },
            'click',
          ),
        addIds[index],
      ),
    ),
  );
  const addOutcomes = await Promise.allSettled(
    session.clients.map(({ page }) =>
      tableNode(page, 't0')
        .getByRole('button', { name: /^(컬럼 추가|Add Column)$/ })
        .click(),
    ),
  );
  const addTimes = await Promise.all(
    session.clients.map(({ page }, index) =>
      page.evaluate((id) => window.__collabBench.read(id).startedAt, addIds[index]),
    ),
  );
  const validAdds =
    addOutcomes.every((outcome) => outcome.status === 'fulfilled') &&
    addTimes.every(Number.isFinite);
  const added = await waitForConvergence(session, (states) => {
    const sets = states.map((state) => (state?.columns.map((column) => column.id) ?? []).sort());
    return (
      validAdds &&
      sets.every(
        (set) =>
          set.length === before.length + session.clients.length &&
          new Set(set).size === set.length &&
          set.every(Boolean) &&
          before.every((id) => set.includes(id)) &&
          JSON.stringify(set) === JSON.stringify(sets[0]),
      )
    );
  });
  session.result.convergence.push({
    check: 'concurrent-column-add-no-loss',
    status: added.pass ? 'PASS' : 'FAIL',
    pass: added.pass,
    expectedColumnCount: before.length + session.clients.length,
    finalColumnIds: added.states.map(
      ({ state }) => state?.columns.map((column) => column.id) ?? [],
    ),
    inputTimes: addTimes,
    dispatchSkewMs: validAdds ? Math.max(...addTimes) - Math.min(...addTimes) : null,
    convergenceMs: added.pass ? added.convergedAt - Math.min(...addTimes) : null,
    stableForMs: added.stableForMs,
  });
  if (!rename.pass || !added.pass)
    session.result.errors.push({ scenario: 'C3', message: 'Convergence/loss check FAIL' });
  for (const outcome of [...outcomes, ...addOutcomes]) {
    if (outcome.status === 'rejected')
      session.result.errors.push({ scenario: 'C3', message: errorMessage(outcome.reason) });
  }
}

/**
 * 유휴 상태와 C2 부하 중의 늦은 합류를 한 번씩 측정한다.
 * @param {object} session 세션
 * @returns {Promise<void>}
 */
async function runC4(session) {
  const idle = await loginClient(session);
  session.result.joins = [{ mode: 'idle', ...(await joinDiagram(session, idle)) }];
  await idle.context.close();
  session.contexts.delete(idle.context);
  const loaded = await loginClient(session);
  await runLoad(session, async () => {
    if (Date.now() >= session.loadWindow.deadline)
      throw new Error('C2 load finished before late join started');
    const join = await joinDiagram(session, loaded);
    session.result.joins.push({ mode: 'under-C2-load', ...join });
  });
}

/**
 * 편집 표본을 전체 및 작업 종류별로 집계한다.
 * @param {object[]} samples 편집 표본
 * @returns {object} p50/p95/max를 포함한 통계
 */
function summarizeEdits(samples) {
  /** 주어진 표본 집합을 집계한다. */
  const stats = (items) => ({
    edits: items.length,
    localMs: summarize(items.map((sample) => sample.localMs)),
    peerMs: summarize(items.flatMap((sample) => sample.peers.map((peer) => peer.latencyMs))),
    missingPeerObservations: items
      .flatMap((sample) => sample.peers)
      .filter((peer) => peer.latencyMs === null).length,
  });
  return {
    ...stats(samples),
    byOperation: Object.fromEntries(
      [...new Set(samples.map((sample) => sample.spec.kind))].map((kind) => [
        kind,
        stats(samples.filter((sample) => sample.spec.kind === kind)),
      ]),
    ),
  };
}

/**
 * 시나리오를 격리해 실행하며 실패해도 다음 시나리오로 진행한다.
 * @param {object} shared 브라우저/공통 설정
 * @param {number} size 시드 크기
 * @param {string} key 시나리오명
 * @returns {Promise<object>} 成功/部分結果
 */
async function runScenario(shared, size, key) {
  const startedAt = Date.now();
  const result = {
    size,
    scenario: key,
    status: 'RUNNING',
    errors: [],
    samples: [],
    convergence: [],
  };
  const session = {
    ...shared,
    key,
    result,
    contexts: new Set(),
    clients: [],
    allClients: [],
    sequence: 0,
  };
  let sampler = null;
  try {
    await prepare(session, size);
    try {
      sampler = await startServerSampler(Number(new URL(shared.config.apiBaseUrl).port || 80));
    } catch (error) {
      result.server = { available: false };
      result.errors.push({ metric: 'server', message: errorMessage(error) });
    }
    if (key === 'C1') await runC1(session);
    else if (key === 'C2') await runLoad(session);
    else if (key === 'C3') await runC3(session);
    else await runC4(session);
  } catch (error) {
    result.errors.push({
      phase: result.fixture ? 'scenario' : 'preparation',
      message: errorMessage(error),
    });
  } finally {
    if (sampler) {
      result.server = await sampler.stop().catch((error) => ({ errors: [errorMessage(error)] }));
      result.errors.push(...result.server.errors.map((message) => ({ metric: 'server', message })));
    }
    result.pageErrors = session.allClients.flatMap((client, index) =>
      client.pageErrors.map((message) => ({ client: index, message })),
    );
    result.errors.push(...result.pageErrors);
    const closed = await Promise.allSettled(
      [...session.contexts].map((context) => context.close()),
    );
    for (const outcome of closed) {
      if (outcome.status === 'rejected')
        result.errors.push({ phase: 'cleanup', message: errorMessage(outcome.reason) });
    }
    result.summary = summarizeEdits(result.samples);
    result.durationMs = Date.now() - startedAt;
    result.status =
      result.errors.length || result.convergence.some((check) => !check.pass) ? 'FAIL' : 'PASS';
  }
  return result;
}

/**
 * JSON의 주요 지표를 Markdown 표로 만든다.
 * @param {object} report 보고서
 * @returns {string} Markdown
 */
function markdown(report) {
  const lines = [
    '# ERD 협업 성능 측정',
    '',
    `- 생성: ${report.environment.generatedAt}`,
    `- 커밋: ${report.environment.commit ?? 'unknown'}`,
    `- Node: ${report.environment.node} / Chromium: ${report.environment.chromium ?? 'unknown'}`,
    `- K=${report.environment.clients}, N=${report.environment.seedSizes.join(',')}, rate=${report.environment.rate}/s/작성자, duration=${report.environment.durationS}s`,
    `- 상태: ${report.status}`,
    '',
    '| 시나리오 | N | 상태 | 편집 수 | 피어 p50/p95/max ms | 로컬 p50/p95/max ms | 서버 CPU 평균/최대 % | RSS 평균/최대 MiB |',
    '|---|---:|---|---:|---|---|---|---|',
  ];
  /** 빈 통계는 하이픈으로 표시한다. */
  const triplet = (stats) => (stats?.n ? `${stats.p50}/${stats.p95}/${stats.max}` : '-');
  const details = [];
  for (const result of report.results) {
    const cpu = result.server?.cpuPercent;
    const rss = result.server?.rssMiB;
    lines.push(
      `| ${result.scenario} | ${result.size} | ${result.status} | ${result.summary.edits} | ${triplet(result.summary.peerMs)} | ${triplet(result.summary.localMs)} | ${cpu?.mean ?? '-'}/${cpu?.max ?? '-'} | ${rss?.mean ?? '-'}/${rss?.max ?? '-'} |`,
    );
    for (const [kind, stats] of Object.entries(result.summary.byOperation)) {
      lines.push(
        `| ↳ ${kind} | ${result.size} | | ${stats.edits} | ${triplet(stats.peerMs)} | ${triplet(stats.localMs)} | | |`,
      );
    }
    for (const check of result.convergence)
      details.push(
        `- S${result.size}/${result.scenario} ${check.check}: **${check.status}**, 수렴 ${check.convergenceMs ?? '-'}ms, 입력 차이 ${check.dispatchSkewMs ?? '-'}ms`,
      );
    for (const join of result.joins ?? [])
      details.push(
        `- S${result.size}/C4 ${join.mode}: 접속→편집 가능 ${join.editableMs.toFixed(3)}ms`,
      );
  }
  lines.push('', '## 수렴 및 합류', '', ...details);
  lines.push(
    '',
    '## 페이지별 부하 지표',
    '',
    '| 시나리오/N/페이지 | longtask 수/합 ms | rAF >50ms | CDP Task/Script/Layout ms | WS 송신 프레임/바이트 | WS 수신 프레임/바이트 | 힙 평균/최대 MiB |',
    '|---|---|---:|---|---|---|---|',
  );
  for (const result of report.results) {
    for (const page of result.pages ?? []) {
      const ws = page.websocket;
      lines.push(
        `| ${result.scenario}/${result.size}/${page.client} | ${page.longtaskCount}/${page.longtaskTotalMs.toFixed(3)} | ${page.frameGapOver50Count} | ${Object.values(
          page.cdpDeltaMs,
        )
          .map((value) => value.toFixed(3))
          .join(
            '/',
          )} | ${ws.sentFrames}/${ws.sentBytes} | ${ws.receivedFrames}/${ws.receivedBytes} | ${page.jsHeapMiB.mean}/${page.jsHeapMiB.max} |`,
      );
    }
  }
  lines.push('', '## 오류 / 타임아웃', '');
  for (const error of report.errors)
    lines.push(`- ${JSON.stringify(error).replaceAll('|', '\\|')}`);
  if (!report.errors.length) lines.push('- 없음');
  lines.push('', '## 한계', '', ...LIMITATIONS.map((note) => `- ${note}`), '');
  return lines.join('\n');
}

/**
 * 각 시나리오가 끝날 때 JSON/Markdown 부분 결과를 저장한다.
 * @param {object} report 보고서
 * @param {string} out JSON 경로
 * @returns {Promise<void>}
 */
async function saveReport(report, out) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(out.replace(/\.json$/, '.md'), markdown(report));
}

/**
 * 기존 서버에 접속하는 벤치마크 진입점. 서버 시작/종료 및 커밋은 하지 않는다.
 * @returns {Promise<void>}
 */
async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: npm run perf:erd:collab -- --scenarios C1,C3 --seed-size 10 --clients 2 --iterations 3\nSee docs/erd-collab-perf.md for every option and metric.\n',
    );
    return;
  }
  const startedAt = Date.now();
  const columns = Math.ceil(Math.sqrt(options.clients));
  const viewport = {
    width: Math.max(1800, columns * 900 + 400),
    height: Math.max(1100, Math.ceil(options.clients / columns) * 740 + 200),
  };
  const report = {
    environment: {
      generatedAt: new Date().toISOString(),
      commit: await commitHash(),
      node: process.version,
      chromium: null,
      platform: `${os.platform()} ${os.arch()}`,
      clients: options.clients,
      seedSizes: options.sizes,
      rate: options.rate,
      durationS: options.durationS,
      requestedScenarios: options.scenarios,
      iterations: options.iterations,
      viewport,
      baseUrl: options.baseUrl,
      apiUrl: options.apiUrl,
    },
    status: 'RUNNING',
    results: [],
    errors: [],
    limitations: LIMITATIONS,
  };
  let browser;
  /** 수신한 종료 신호. */
  let interrupted = null;
  /** 브라우저를 닫아 진행 중인 Playwright 작업을 중단한다. */
  const onSignal = (signal) => {
    interrupted = signal;
    void browser?.close().catch(() => {});
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    const executablePath = resolveChromiumPath(options['chromium-path']);
    report.environment.chromiumPath = executablePath;
    browser = await chromium.launch({ executablePath, headless: true });
    report.environment.chromium = browser.version();
    const helpers = await loadDiagramHelpers();
    const frontend = new URL(options.baseUrl);
    const backend = new URL(options.apiUrl);
    const config = {
      baseUrl: options.baseUrl,
      apiBaseUrl: options.apiUrl,
      frontendHost: frontend.hostname.replace(/^\[|\]$/g, ''),
      frontendPort: Number(frontend.port || (frontend.protocol === 'https:' ? 443 : 80)),
      backendHost: backend.hostname.replace(/^\[|\]$/g, ''),
      backendPort: Number(backend.port || (backend.protocol === 'https:' ? 443 : 80)),
    };
    for (const size of options.sizes) {
      for (const key of options.scenarios) {
        if (interrupted) break;
        process.stderr.write(`[S${size}/${key}] preparing and measuring\n`);
        const result = await runScenario(
          { options, browser, helpers, config, viewport },
          size,
          key,
        );
        report.results.push(result);
        report.errors.push(...result.errors.map((error) => ({ size, scenario: key, ...error })));
        process.stderr.write(`[S${size}/${key}] ${result.status} (${result.durationMs}ms)\n`);
        await saveReport(report, options.out);
      }
    }
  } catch (error) {
    report.errors.push({ phase: 'startup', message: errorMessage(error) });
  } finally {
    await browser
      ?.close()
      .catch((error) =>
        report.errors.push({ phase: 'browser-cleanup', message: errorMessage(error) }),
      );
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    if (interrupted) report.errors.push({ phase: 'signal', message: interrupted });
    report.durationMs = Date.now() - startedAt;
    report.finishedAt = new Date().toISOString();
    report.status = report.errors.length ? 'FAIL' : 'PASS';
    await saveReport(report, options.out);
  }
  process.stdout.write(`${report.status}: ${options.out} (${report.durationMs}ms)\n`);
  if (report.status === 'FAIL') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
