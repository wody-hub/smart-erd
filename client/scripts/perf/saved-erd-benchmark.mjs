#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../');
const FORBIDDEN_PORTS = new Set(['9501', '9502']);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (
      name === 'help' ||
      name === 'smoke-only' ||
      name === 'fallback-diagnostic' ||
      name === 'trace-only' ||
      name === 'route-detour-off'
    ) {
      const flagName =
        name === 'help'
          ? 'help'
          : name === 'smoke-only'
            ? 'smokeOnly'
            : name === 'trace-only'
              ? 'traceOnly'
              : name === 'route-detour-off'
                ? 'routeDetourOff'
                : 'fallbackDiagnostic';
      options[flagName] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return `Usage: node scripts/perf/saved-erd-benchmark.mjs --base-url URL --backend-url URL
  --api-proxy-target URL --ws-direct-base-url URL --team-id ID --project-id ID
  --diagram-id ID --variant NAME --warmup N --samples N --output-dir PRIVATE_DIR
  --clone-name NAME --pg-port PORT --lifecycle-command SCRIPT
  --frontend-command-json '["npm","run","test:frontend","--","--host","127.0.0.1","--port","4504","--strictPort"]'
  --smoke-only  Run one authenticated readiness/network check without saving sample data
  --fallback-diagnostic  Run at most two warmed attempts and save diagnostic snapshots privately
  --diagnostic-attempts N  Limit --fallback-diagnostic to one or two attempts (default: 2)
  --invalid-retry-limit N  Maximum extra attempts for invalid timing samples (default: 2)
  --trace-only  Capture one separate CDP CPU trace without aggregating timing samples
  --route-detour-off  Skip only buildObstacleAvoidingAutoRoute for this probe run

Environment: ERD_PERF_LOGIN_ID and ERD_PERF_PASSWORD (or ERD_PERF_LOGIN_ID_FILE).
The lifecycle command runs with ERD_PERF_ACTION=start|stop, ERD_PERF_RUN_ID,
ERD_PERF_RUN_DB, ERD_PERF_BACKEND_PORT, and ERD_PERF_BACKEND_URL. It must leave
the backend in the foreground for start and drop only the named run DB on stop.
The command's output is discarded to keep logs and credentials private.
`;
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`Missing required option --${name}`);
  return value;
}

function assertPrivateOutputDir(path) {
  if (!isAbsolute(path)) throw new Error('--output-dir must be absolute');
  const resolved = resolve(path);
  const relativePath = relative(repoRoot, resolved);
  if (relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..')) {
    throw new Error('--output-dir must be outside the repository');
  }
  return resolved;
}

function normalizeOrigin(value, protocol) {
  const url = new URL(value);
  if (protocol && url.protocol !== protocol) throw new Error(`Expected ${protocol} URL`);
  return `${url.protocol}//${url.host}`;
}

function assertNetworkTargets(options) {
  const backendOrigin = normalizeOrigin(options.backendUrl, 'http:');
  const apiOrigin = normalizeOrigin(options.apiProxyTarget, 'http:');
  const expectedWsOrigin = normalizeOrigin(options.wsDirectBaseUrl, 'ws:');
  const backendWsOrigin = `ws://${new URL(backendOrigin).host}`;
  if (FORBIDDEN_PORTS.has(new URL(backendOrigin).port)) {
    throw new Error('Backend URL points at an original backend port; refusing to run');
  }
  if (apiOrigin !== backendOrigin) {
    throw new Error('API proxy target does not match the isolated backend; refusing to run');
  }
  if (expectedWsOrigin !== backendWsOrigin) {
    throw new Error('Direct WebSocket target does not match the isolated backend; refusing to run');
  }
  if (
    process.env.VITE_API_PROXY_TARGET &&
    normalizeOrigin(process.env.VITE_API_PROXY_TARGET) !== apiOrigin
  ) {
    throw new Error('VITE_API_PROXY_TARGET does not match --api-proxy-target; refusing to run');
  }
  if (
    process.env.VITE_WS_DIRECT_BASE_URL &&
    normalizeOrigin(process.env.VITE_WS_DIRECT_BASE_URL, 'ws:') !== expectedWsOrigin
  ) {
    throw new Error('VITE_WS_DIRECT_BASE_URL does not match --ws-direct-base-url; refusing to run');
  }
  return { backendOrigin, backendWsOrigin };
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    n: sorted.length,
    min: sorted[0] ?? null,
    median: percentile(sorted, 0.5),
    max: sorted.at(-1) ?? null,
    iqr: sorted.length ? percentile(sorted, 0.75) - percentile(sorted, 0.25) : null,
  };
}

function eventTime(snapshot, eventName) {
  return snapshot.events.find((event) => event.type === eventName)?.t ?? null;
}

function eventCounts(snapshot, eventName) {
  return snapshot.events.filter((event) => event.type === eventName).length;
}

function sampleMetrics(snapshot, network, version, runId) {
  const longTasks = snapshot.events
    .filter((event) => event.type === 'long-task')
    .map(({ t, detail }) => ({ startMs: detail?.start ?? t, durationMs: detail?.duration ?? 0 }));
  const longTaskBlockingExcessMs = longTasks.reduce(
    (sum, task) => sum + Math.max(task.durationMs - 50, 0),
    0,
  );
  let observedConnected = false;
  let reconnectCount = 0;
  for (const event of snapshot.events) {
    if (event.type !== 'readiness:connected') continue;
    if (event.detail?.value === true) observedConnected = true;
    else if (event.detail?.value === false && observedConnected) reconnectCount += 1;
  }
  const fallbacks = snapshot.events.filter((event) => event.type === 'preview-fallback').length;
  const errors = snapshot.errors.length;
  const wsFrames = network.wsFrames;
  const resourceTimings = network.resources;
  const validReasons = [];
  if (snapshot.ready.liveReadyAt == null) validReasons.push('missing-live-ready');
  if (snapshot.ready.liveSettledAt == null) validReasons.push('missing-live-settled');
  if (fallbacks > 0) validReasons.push('preview-fallback');
  if (reconnectCount > 0) validReasons.push('websocket-disconnect');
  if (errors > 0) validReasons.push('javascript-error');
  if (snapshot.graph.expectedNodes == null || snapshot.graph.expectedEdges == null) {
    validReasons.push('missing-expected-graph-counts');
  }
  if (snapshot.graph.nodes !== snapshot.graph.expectedNodes)
    validReasons.push('node-count-mismatch');
  if (snapshot.graph.edges !== snapshot.graph.expectedEdges)
    validReasons.push('edge-count-mismatch');

  return {
    runId,
    variant: network.variant,
    browserVersion: version,
    valid: validReasons.length === 0,
    invalidReasons: validReasons,
    liveReadyMs: snapshot.ready.liveReadyAt,
    liveSettledMs: snapshot.ready.liveSettledAt,
    previewStoreReadyMs: eventTime(snapshot, 'preview-store-ready'),
    previewCommitMs: eventTime(snapshot, 'preview-commit'),
    previewPresentationProxyMs: eventTime(snapshot, 'preview-presentation-proxy'),
    liveCommitMs: eventTime(snapshot, 'live-commit'),
    livePresentationProxyMs: eventTime(snapshot, 'live-presentation-proxy'),
    longTaskCount: longTasks.length,
    longTaskBlockingExcessMs,
    longTasks,
    rafGapCount: snapshot.counters['raf-gap']?.calls ?? 0,
    rafGapMaxMs: snapshot.counters['raf-gap']?.maxMs ?? 0,
    graph: snapshot.graph,
    lifecycleCounts: snapshot.lifecycleCounts,
    counters: snapshot.counters,
    websocketFrameCount: wsFrames.length,
    websocketHandshakeStatuses: network.wsHandshakeStatuses,
    diagramWebSocketCount: network.diagramWebSocketCount,
    websocketFrameBytes: wsFrames.reduce((sum, frame) => sum + frame.bytes, 0),
    websocketFrames: wsFrames,
    httpResources: resourceTimings,
    preflightApiResponses: network.preflightApiResponses,
    apiResponses: network.apiResponses,
    errorCount: errors,
    fallbackCount: fallbacks,
    reconnectCount,
    headingFound: network.headingFound,
    connectionStatusFound: network.connectionStatusFound,
    probeEventCount: snapshot.events.length,
    probeEventCounts: Object.fromEntries(
      ['preview-visible', 'preview-unlock', 'ws-open', 'ws-sync', 'live-ready', 'live-settled'].map(
        (name) => [name, eventCounts(snapshot, name)],
      ),
    ),
  };
}

async function waitForBackend(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null)
      throw new Error('Lifecycle command exited before backend became reachable');
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) });
      return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error('Isolated backend did not become reachable within 60 seconds');
}

async function waitForEndpoint(url, child, label) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null)
      throw new Error(`${label} command exited before becoming reachable`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) });
      return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error(`${label} did not become reachable within 60 seconds`);
}

function startFrontend(commandArgv, environment) {
  if (
    !Array.isArray(commandArgv) ||
    commandArgv.length === 0 ||
    commandArgv.some((part) => typeof part !== 'string')
  ) {
    throw new Error('--frontend-command-json must be a nonempty JSON array of strings');
  }
  const [executable, ...args] = commandArgv;
  const child = spawn(executable, args, {
    shell: false,
    cwd: resolve(repoRoot, 'client'),
    env: { ...process.env, ...environment },
    stdio: 'ignore',
  });
  child.once('error', () => {});
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGINT');
  await new Promise((resolvePromise) => {
    const timeout = setTimeout(resolvePromise, 12_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });
  if (child.exitCode == null) child.kill('SIGTERM');
}

async function spawnLifecycle(command, action, environment) {
  const child = spawn(command, [], {
    shell: true,
    env: { ...process.env, ...environment, ERD_PERF_ACTION: action },
    stdio: 'ignore',
  });
  if (action === 'stop') {
    const exitCode = await new Promise((resolvePromise, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolvePromise(code));
    });
    if (exitCode !== 0) throw new Error('Lifecycle stop command failed');
    return null;
  }
  child.once('error', () => {});
  return child;
}

async function stopLifecycle(child, command, environment) {
  if (child && child.exitCode == null) {
    child.kill('SIGINT');
    await new Promise((resolvePromise) => {
      const timeout = setTimeout(resolvePromise, 12_000);
      child.once('exit', () => {
        clearTimeout(timeout);
        resolvePromise();
      });
    });
    if (child.exitCode == null) child.kill('SIGTERM');
  }
  await spawnLifecycle(command, 'stop', environment);
}

async function finishCdpTrace(cdp, outputPath) {
  const completed = new Promise((resolvePromise) => {
    cdp.once('Tracing.tracingComplete', resolvePromise);
  });
  await cdp.send('Tracing.end');
  const { stream } = await completed;
  const chunks = [];
  let eof = false;
  while (!eof) {
    const result = await cdp.send('IO.read', { handle: stream });
    chunks.push(
      result.base64Encoded ? Buffer.from(result.data, 'base64') : Buffer.from(result.data),
    );
    eof = result.eof;
  }
  await cdp.send('IO.close', { handle: stream });
  await writeFile(outputPath, Buffer.concat(chunks), { mode: 0o600, flag: 'wx' });
}

async function runOne(
  options,
  expectedOrigins,
  login,
  password,
  index,
  warmup,
  browserVersion,
  traceFile,
) {
  const runId = `${options.variant}-${String(index).padStart(2, '0')}-${Date.now()}`;
  const runDb = `saved_erd_run_${options.variant.replace(/[^A-Za-z0-9_]/g, '_')}_${String(index).padStart(2, '0')}`;
  const backendPort = options.backendPort ?? '9510';
  const lifecycleEnv = {
    ERD_PERF_RUN_ID: runId,
    ERD_PERF_RUN_DB: runDb,
    ERD_PERF_BACKEND_PORT: backendPort,
    ERD_PERF_BACKEND_URL: options.backendUrl,
    ERD_PERF_PG_PORT: options.pgPort ?? '',
    CLONE_NAME: options.cloneName,
    CLONE_PORT: options.pgPort,
    CLONE_USER: process.env.CLONE_USER ?? 'smarterd',
  };
  const server = await spawnLifecycle(options.lifecycleCommand, 'start', lifecycleEnv);
  let browser;
  let context;
  let page;
  let cdp;
  let guardFailure = null;
  const network = {
    variant: options.variant,
    wsFrames: [],
    wsHandshakeStatuses: [],
    diagramWebSocketCount: 0,
    resources: [],
    headingFound: false,
    connectionStatusFound: false,
    diagramWebSocketSeen: false,
    apiResponses: [],
    preflightApiResponses: [],
  };
  try {
    await waitForBackend(options.backendUrl, server);
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await context.addInitScript(
      ({ runId: initRunId, routeDetourOff }) => {
        window.__ERD_PERF_PROBE_ENABLE__ = true;
        window.__ERD_PERF_ROUTE_DETOUR_OFF__ = routeDetourOff;
        window.__ERD_PERF_RUN_ID__ = initRunId;
      },
      { runId, routeDetourOff: options.routeDetourOff },
    );
    page = await context.newPage();
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        if (FORBIDDEN_PORTS.has(url.port)) guardFailure = 'request-targeted-original-backend-port';
      } catch {
        guardFailure = 'invalid-network-request-url';
      }
    });
    page.on('websocket', (websocket) => {
      const url = new URL(websocket.url());
      if (FORBIDDEN_PORTS.has(url.port)) guardFailure = 'websocket-targeted-original-backend-port';
      if (url.pathname.startsWith('/ws/diagram/')) {
        network.diagramWebSocketSeen = true;
        network.diagramWebSocketCount += 1;
        const target = `${url.protocol}//${url.host}`;
        if (target !== expectedOrigins.backendWsOrigin)
          guardFailure = 'diagram-websocket-target-mismatch';
      }
    });
    page.on('pageerror', () => {
      // Error text can contain customer data; the probe records only the kind.
    });
    page.on('response', (response) => {
      try {
        const url = new URL(response.url());
        if (url.origin === normalizeOrigin(options.baseUrl) && url.pathname.startsWith('/api/')) {
          network.apiResponses.push({ path: url.pathname, status: response.status() });
        }
      } catch {
        // Ignore malformed or non-HTTP response URLs.
      }
    });

    const loginUrl = new URL('/login', options.baseUrl).href;
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#login-id').fill(login);
    await page.locator('#password').fill(password);
    await page.locator('form button[type="submit"]').click();
    try {
      await page.waitForURL((url) => url.pathname.startsWith('/teams'), { timeout: 20_000 });
    } catch {
      throw new Error(
        `Login preflight failed: ${JSON.stringify({
          currentPath: new URL(page.url()).pathname,
          apiResponses: network.apiResponses,
        })}`,
      );
    }

    // Warm the authenticated project/diagram-list path before timing the collaborative diagram.
    const diagramListResponse = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          url.origin === normalizeOrigin(options.baseUrl) &&
          url.pathname === `/api/teams/${options.teamId}/projects/${options.projectId}/diagrams` &&
          response.ok()
        );
      },
      { timeout: 20_000 },
    );
    await page.goto(
      new URL(`/teams/${options.teamId}/projects/${options.projectId}/diagrams`, options.baseUrl)
        .href,
      {
        waitUntil: 'domcontentloaded',
      },
    );
    await diagramListResponse;
    network.preflightApiResponses = network.apiResponses.splice(0);
    await page.evaluate(() => performance.clearResourceTimings());

    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const diagramWebSocketRequestIds = new Set();
    cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
      if (new URL(url).pathname.startsWith('/ws/diagram/')) {
        diagramWebSocketRequestIds.add(requestId);
      }
    });
    cdp.on('Network.webSocketHandshakeResponseReceived', ({ requestId, response }) => {
      if (!diagramWebSocketRequestIds.has(requestId)) return;
      network.wsHandshakeStatuses.push(response.status);
    });
    cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
      if (!diagramWebSocketRequestIds.has(requestId)) return;
      const bytes =
        response.opcode === 2
          ? Math.floor((response.payloadData.length * 3) / 4)
          : Buffer.byteLength(response.payloadData);
      network.wsFrames.push({ direction: 'received', opcode: response.opcode, bytes });
    });
    cdp.on('Network.webSocketFrameSent', ({ requestId, response }) => {
      if (!diagramWebSocketRequestIds.has(requestId)) return;
      const bytes =
        response.opcode === 2
          ? Math.floor((response.payloadData.length * 3) / 4)
          : Buffer.byteLength(response.payloadData);
      network.wsFrames.push({ direction: 'sent', opcode: response.opcode, bytes });
    });
    if (traceFile) {
      await cdp.send('Tracing.start', {
        categories: [
          'devtools.timeline',
          'v8',
          'blink.user_timing',
          'disabled-by-default-v8.cpu_profiler',
          'disabled-by-default-v8.cpu_profiler.hires',
          'disabled-by-default-devtools.screenshot',
        ].join(','),
        transferMode: 'ReturnAsStream',
      });
    }

    const diagramPath = `/teams/${options.teamId}/projects/${options.projectId}/diagrams/${options.diagramId}`;
    await page.goto(new URL(diagramPath, options.baseUrl).href, { waitUntil: 'domcontentloaded' });

    try {
      await page.waitForFunction(
        () => {
          const snapshot = window.__ERD_PERF_SNAPSHOT__?.();
          return (
            !!snapshot &&
            (snapshot.ready.liveSettledAt != null || snapshot.ready.liveSettledTimeoutAt != null)
          );
        },
        null,
        { timeout: 35_000, polling: 50 },
      );
    } catch {
      // The missing readiness marker is reported as an invalid run below.
    }
    if (traceFile && cdp) await finishCdpTrace(cdp, traceFile);
    if (guardFailure) throw new Error(`Network guard rejected run: ${guardFailure}`);

    network.headingFound = await page
      .getByRole('heading')
      .count()
      .then((count) => count > 0);
    network.connectionStatusFound = await page
      .getByText('연결됨', { exact: true })
      .count()
      .then((count) => count > 0);
    network.resources = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/api/'))
        .map((entry) => {
          const url = new URL(entry.name);
          return {
            path: url.pathname,
            startMs: Math.round(entry.startTime * 10) / 10,
            durationMs: Math.round(entry.duration * 10) / 10,
            transferBytes: entry.transferSize,
            responseStatus: 'responseStatus' in entry ? entry.responseStatus : null,
          };
        }),
    );
    const snapshot = await page.evaluate(() => window.__ERD_PERF_SNAPSHOT__?.() ?? null);
    if (!snapshot) throw new Error('Opt-in probe did not expose its final snapshot');
    const metrics = sampleMetrics(snapshot, network, browserVersion, runId);
    if (!network.headingFound) {
      metrics.valid = false;
      metrics.invalidReasons.push('diagram-heading-not-found');
    }
    if (!network.diagramWebSocketSeen) {
      metrics.valid = false;
      metrics.invalidReasons.push('diagram-websocket-not-seen');
    }
    return { metrics, snapshot };
  } finally {
    if (cdp) await cdp.detach().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await stopLifecycle(server, options.lifecycleCommand, lifecycleEnv).catch(() => {});
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(usage());
    return;
  }
  const options = {
    baseUrl: requireOption(parsed, 'base-url'),
    backendUrl: requireOption(parsed, 'backend-url'),
    apiProxyTarget: requireOption(parsed, 'api-proxy-target'),
    wsDirectBaseUrl: requireOption(parsed, 'ws-direct-base-url'),
    teamId: requireOption(parsed, 'team-id'),
    projectId: requireOption(parsed, 'project-id'),
    diagramId: requireOption(parsed, 'diagram-id'),
    variant: requireOption(parsed, 'variant'),
    outputDir: assertPrivateOutputDir(requireOption(parsed, 'output-dir')),
    lifecycleCommand: requireOption(parsed, 'lifecycle-command'),
    frontendCommand: JSON.parse(requireOption(parsed, 'frontend-command-json')),
    cloneName: requireOption(parsed, 'clone-name'),
    backendPort: parsed['backend-port'] ?? '9510',
    pgPort: requireOption(parsed, 'pg-port'),
    warmup: Number(parsed.warmup ?? 1),
    samples: Number(parsed.samples ?? 5),
    diagnosticAttempts: Number(parsed['diagnostic-attempts'] ?? 2),
    invalidRetryLimit: Number(parsed['invalid-retry-limit'] ?? 2),
    routeDetourOff: parsed.routeDetourOff === true,
  };
  if (!Number.isInteger(options.warmup) || options.warmup < 0)
    throw new Error('--warmup must be a nonnegative integer');
  if (!Number.isInteger(options.samples) || options.samples < 1)
    throw new Error('--samples must be a positive integer');
  if (
    !Number.isInteger(options.diagnosticAttempts) ||
    options.diagnosticAttempts < 1 ||
    options.diagnosticAttempts > 2
  ) {
    throw new Error('--diagnostic-attempts must be 1 or 2');
  }
  if (
    !Number.isInteger(options.invalidRetryLimit) ||
    options.invalidRetryLimit < 0 ||
    options.invalidRetryLimit > 5
  ) {
    throw new Error('--invalid-retry-limit must be an integer from 0 to 5');
  }
  const origins = assertNetworkTargets(options);
  if (new URL(options.backendUrl).port !== String(options.backendPort)) {
    throw new Error('--backend-url port must match --backend-port; refusing to run');
  }
  let login = process.env.ERD_PERF_LOGIN_ID;
  if (!login && process.env.ERD_PERF_LOGIN_ID_FILE) {
    const { readFile } = await import('node:fs/promises');
    login = (await readFile(process.env.ERD_PERF_LOGIN_ID_FILE, 'utf8')).trim();
  }
  const password = process.env.ERD_PERF_PASSWORD;
  if (!login || !password) throw new Error('ERD_PERF_LOGIN_ID/ERD_PERF_PASSWORD are required');
  if (!parsed.smokeOnly) await mkdir(options.outputDir, { recursive: false, mode: 0o700 });
  const frontend = startFrontend(options.frontendCommand, {
    VITE_API_PROXY_TARGET: origins.backendOrigin,
    VITE_WS_PROXY_TARGET: origins.backendWsOrigin,
    VITE_WS_DIRECT_BASE_URL: origins.backendWsOrigin,
    VITE_ERD_PERF_PROBE: 'true',
  });
  let browserVersion;
  try {
    await waitForEndpoint(options.baseUrl, frontend, 'Frontend');
    const browser = await chromium.launch({ headless: true });
    browserVersion = browser.version();
    await browser.close();

    if (parsed.smokeOnly) {
      const result = await runOne(options, origins, login, password, 1, false, browserVersion);
      const readinessAndNetworkPassed =
        result.metrics.liveReadyMs != null &&
        result.metrics.liveSettledMs != null &&
        result.metrics.graph.nodes === result.metrics.graph.expectedNodes &&
        result.metrics.graph.edges === result.metrics.graph.expectedEdges &&
        result.metrics.websocketHandshakeStatuses.includes(101) &&
        result.metrics.reconnectCount === 0;
      if (!readinessAndNetworkPassed) {
        throw new Error(
          `Smoke failed: ${JSON.stringify({
            ready: result.snapshot.ready,
            graph: result.snapshot.graph,
            websocketHandshakeStatuses: result.metrics.websocketHandshakeStatuses,
            diagramWebSocketCount: result.metrics.diagramWebSocketCount,
            reconnectCount: result.metrics.reconnectCount,
          })}`,
        );
      }
      process.stdout.write(
        `${JSON.stringify({
          smoke: result.metrics.valid ? 'passed' : 'passed-readiness-with-invalid-sample',
          sampleValid: result.metrics.valid,
          sampleInvalidReasons: result.metrics.invalidReasons,
          liveReady: result.metrics.liveReadyMs != null,
          liveSettled: result.metrics.liveSettledMs != null,
          expectedGraphMatches:
            result.metrics.graph.nodes === result.metrics.graph.expectedNodes &&
            result.metrics.graph.edges === result.metrics.graph.expectedEdges,
          diagramHeadingFound: result.metrics.headingFound,
          connectedStatusFound: result.metrics.connectionStatusFound,
          websocketFrameCount: result.metrics.websocketFrameCount,
          websocketHandshakeStatuses: result.metrics.websocketHandshakeStatuses,
          browserVersion,
        })}\n`,
      );
      return;
    }

    if (parsed.traceOnly) {
      const traceFile = resolve(options.outputDir, 'production-cpu-trace.json');
      const result = await runOne(
        options,
        origins,
        login,
        password,
        1,
        false,
        browserVersion,
        traceFile,
      );
      const summaryFile = resolve(options.outputDir, 'production-cpu-trace-summary.json');
      await writeFile(
        summaryFile,
        `${JSON.stringify(
          {
            runId: result.metrics.runId,
            valid: result.metrics.valid,
            invalidReasons: result.metrics.invalidReasons,
            liveReadyMs: result.metrics.liveReadyMs,
            liveSettledMs: result.metrics.liveSettledMs,
            longTaskCount: result.metrics.longTaskCount,
            longTaskBlockingExcessMs: result.metrics.longTaskBlockingExcessMs,
            longTasks: result.metrics.longTasks,
            graph: result.metrics.graph,
            previewEvents: result.snapshot.events
              .filter((event) =>
                [
                  'preview-store-ready',
                  'preview-visible',
                  'preview-unlock',
                  'preview-fallback',
                  'preview-commit',
                  'preview-presentation-proxy',
                  'live-ready',
                  'live-commit',
                  'live-presentation-proxy',
                  'live-settled',
                ].includes(event.type),
              )
              .map(({ t, type, detail }) => ({ t, type, detail })),
            preflightApiResponses: result.metrics.preflightApiResponses,
            diagramWebSocketCount: result.metrics.diagramWebSocketCount,
            websocketHandshakeStatuses: result.metrics.websocketHandshakeStatuses,
            traceFile,
          },
          null,
          2,
        )}\n`,
        { mode: 0o600, flag: 'wx' },
      );
      process.stdout.write(
        `${JSON.stringify({
          trace: 'captured',
          valid: result.metrics.valid,
          liveReadyMs: result.metrics.liveReadyMs,
          liveSettledMs: result.metrics.liveSettledMs,
          longTaskCount: result.metrics.longTaskCount,
          longTaskBlockingExcessMs: result.metrics.longTaskBlockingExcessMs,
          traceFile,
          summaryFile,
        })}\n`,
      );
      return;
    }

    if (parsed.fallbackDiagnostic) {
      const attempts = [];
      for (let index = 1; index <= options.diagnosticAttempts; index += 1) {
        const result = await runOne(
          options,
          origins,
          login,
          password,
          index,
          false,
          browserVersion,
        );
        const privateFile = resolve(options.outputDir, `${result.metrics.runId}.json`);
        await writeFile(privateFile, `${JSON.stringify(result, null, 2)}\n`, {
          mode: 0o600,
          flag: 'wx',
        });
        const events = result.snapshot.events
          .filter((event) =>
            [
              'lifecycle-mount',
              'lifecycle-unmount',
              'preview-visible',
              'preview-unlock',
              'preview-fallback',
              'readiness:connected',
              'ws-open',
              'snapshot-message',
              'readiness:remoteSnapshotApplied',
              'live-ready',
              'live-settled',
            ].includes(event.type),
          )
          .map(({ t, type, lifecycleId, detail }) => ({ t, type, lifecycleId, detail }));
        attempts.push({
          runId: result.metrics.runId,
          valid: result.metrics.valid,
          invalidReasons: result.metrics.invalidReasons,
          liveReadyMs: result.metrics.liveReadyMs,
          liveSettledMs: result.metrics.liveSettledMs,
          graph: result.metrics.graph,
          websocketHandshakeStatuses: result.metrics.websocketHandshakeStatuses,
          diagramWebSocketCount: result.metrics.diagramWebSocketCount,
          preflightApiResponses: result.metrics.preflightApiResponses,
          apiResponses: result.metrics.apiResponses,
          longTaskCount: result.metrics.longTaskCount,
          longTaskBlockingExcessMs: result.metrics.longTaskBlockingExcessMs,
          longTasks: result.metrics.longTasks,
          events,
          privateFile,
        });
        if (result.metrics.invalidReasons.includes('preview-fallback')) {
          process.stdout.write(
            `${JSON.stringify({ diagnostic: 'preview-fallback-observed', attempt: index, runId: result.metrics.runId })}\n`,
          );
          continue;
        }
        process.stdout.write(
          `${JSON.stringify({ diagnostic: 'remote-preview-unlock-observed', attempt: index, runId: result.metrics.runId })}\n`,
        );
        break;
      }
      await writeFile(
        resolve(options.outputDir, 'fallback-diagnostic.json'),
        `${JSON.stringify(
          {
            variant: options.variant,
            baseUrl: normalizeOrigin(options.baseUrl),
            backendUrl: origins.backendOrigin,
            browserVersion,
            attempts,
            privateOutputDir: options.outputDir,
          },
          null,
          2,
        )}\n`,
        { mode: 0o600, flag: 'wx' },
      );
      const fallbackAttempts = attempts.filter((attempt) =>
        attempt.invalidReasons.includes('preview-fallback'),
      ).length;
      if (fallbackAttempts === options.diagnosticAttempts) {
        process.stdout.write(
          `${JSON.stringify({ diagnostic: 'stopped-after-consecutive-fallbacks', count: fallbackAttempts })}\n`,
        );
      }
      return;
    }

    const validSamples = [];
    const invalidSamples = [];
    const warmups = [];
    const maxAttempts = options.samples + options.warmup + options.invalidRetryLimit;
    for (let index = 1; index <= maxAttempts && validSamples.length < options.samples; index += 1) {
      const isWarmup = index <= options.warmup;
      const result = await runOne(
        options,
        origins,
        login,
        password,
        index,
        isWarmup,
        browserVersion,
      );
      const filename = resolve(options.outputDir, `${result.metrics.runId}.json`);
      await writeFile(filename, `${JSON.stringify(result, null, 2)}\n`, {
        mode: 0o600,
        flag: 'wx',
      });
      if (isWarmup) {
        warmups.push(result.metrics);
      } else if (result.metrics.valid) {
        validSamples.push(result.metrics);
      } else {
        invalidSamples.push(result.metrics);
      }
      process.stdout.write(
        `${isWarmup ? 'warmup' : result.metrics.valid ? 'valid' : 'invalid'} ${result.metrics.runId}\n`,
      );
    }
    if (validSamples.length !== options.samples) {
      throw new Error(
        `Only ${validSamples.length}/${options.samples} valid samples completed; see private run files`,
      );
    }

    const summary = {
      variant: options.variant,
      baseUrl: normalizeOrigin(options.baseUrl),
      backendUrl: origins.backendOrigin,
      databasePort: options.pgPort || null,
      browserVersion,
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      warmupCount: warmups.length,
      validSampleCount: validSamples.length,
      invalidSamples: invalidSamples.map(({ runId, invalidReasons }) => ({
        runId,
        invalidReasons,
      })),
      metrics: {
        liveReadyMs: summarize(validSamples.map((sample) => sample.liveReadyMs)),
        liveSettledMs: summarize(validSamples.map((sample) => sample.liveSettledMs)),
        longTaskBlockingExcessMs: summarize(
          validSamples.map((sample) => sample.longTaskBlockingExcessMs),
        ),
        longTaskCount: summarize(validSamples.map((sample) => sample.longTaskCount)),
      },
      samples: validSamples,
      privateOutputDir: options.outputDir,
    };
    await writeFile(
      resolve(options.outputDir, 'aggregate.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
      {
        mode: 0o600,
        flag: 'wx',
      },
    );
    process.stdout.write(
      `${JSON.stringify({
        variant: summary.variant,
        validSampleCount: summary.validSampleCount,
        liveReadyMs: summary.metrics.liveReadyMs,
        liveSettledMs: summary.metrics.liveSettledMs,
        longTaskBlockingExcessMs: summary.metrics.longTaskBlockingExcessMs,
        privateOutputDir: summary.privateOutputDir,
      })}\n`,
    );
  } finally {
    await stopProcess(frontend);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n${usage()}`);
  process.exitCode = 1;
});
