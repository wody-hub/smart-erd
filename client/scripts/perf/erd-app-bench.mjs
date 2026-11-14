#!/usr/bin/env node
/**
 * ERD 앱 코드 경로 벤치마크 (erd-local 라우트).
 *
 * 로컬 Vite(dev, `npm run local`)로 `/erd-local`을 띄우고, localStorage에 대형 시드(S200/S500/S1000)를
 * 심은 뒤 headless Chromium에서 실제 UI 입력(키보드/마우스)으로 편집 1건의 비용을 잰다.
 * 제품 코드(`src/**`)는 수정하지 않는다. 계측은 (1) 기존 인앱 probe(`erd-performance-probe.ts`),
 * (2) 페이지에 주입한 PerformanceObserver/MutationObserver/React DevTools hook, (3) CDP Performance 메트릭이다.
 *
 * 사용법:
 *   node scripts/perf/erd-app-bench.mjs --scenarios S200,S500,S1000 --iterations 10 --out ./perf-reports/erd-app-baseline.json
 * 옵션:
 *   --scenarios S200,...   시드 크기 목록 (기본 S200)
 *   --iterations N         측정 반복 횟수 (기본 10)
 *   --warmup N             워밍업 횟수 (기본 2)
 *   --out PATH             결과 JSON 경로 (기본 ./perf-reports/erd-app-baseline.json)
 *   --only a,b,c,d,idle    일부 시나리오만 실행 (기본 전체)
 *   --port N               Vite 포트 (기본 4501, 사용 중이면 4511부터 빈 포트 탐색)
 *   --base-url URL         이미 떠 있는 서버 사용 (VITE_ERD_PERF_PROBE=true 필요, Vite 기동/종료 안 함)
 *   --chromium-path PATH   Chromium 실행 파일 (기본: playwright 기본 → 캐시된 chromium-* 자동 탐색)
 *   --no-align-autosave    반복 사이 autosave tick 정렬 끄기
 *   --settle-max-s N       편집 후 정착 대기 상한(초, 기본 12). 초과하면 settleCapped=1이고 해당 값은 하한이다
 *   --scenario-timeout-s N 시나리오 1개(한 크기)당 제한 시간, 초과 시 해당 시나리오를 실패로 기록 (기본 420)
 *   --profile              시나리오마다 CPU 프로파일 패스 1회를 추가해 self-time 상위 함수/파일을 JSON에 기록
 *   --headed               창 표시
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildErdLocalSeed, parseScenarioSize } from './lib/erd-app-seed.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(scriptDir, '../..');
/** localStorage 초안 키 (src/constants/storage.ts ERD_LOCAL_DRAFT) */
const DRAFT_KEY = 'smart-erd-erd-local-draft';
/** Vite 로그 최대 바이트 */
const VITE_LOG_MAX_BYTES = 2_000_000;
/** 편집 후 최소 관찰 시간 */
const SETTLE_MIN_MS = 1000;
/** 편집 후 최대 관찰 시간 기본값 (`--settle-max-s`로 변경) */
const SETTLE_MAX_MS = 12_000;
/** 정착 판정에 필요한 무활동 시간 */
const SETTLE_QUIET_MS = 500;
/** idle 시나리오 관찰 시간 (autosave 5s tick 포함) */
const IDLE_WINDOW_MS = 5600;
/** 반복 사이 autosave 대기 상한 */
const AUTOSAVE_WAIT_MS = 6500;

// ---------------------------------------------------------------------------------------------
// 인자 / 통계 유틸
// ---------------------------------------------------------------------------------------------

/**
 * CLI 인자를 파싱한다 (뒤에 오는 같은 키가 앞의 값을 덮어쓴다).
 *
 * @param argv process.argv.slice(2)
 * @returns 옵션 객체
 */
function parseArgs(argv) {
  const options = {};
  const flags = new Set(['help', 'no-align-autosave', 'headed', 'profile']);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (flags.has(name)) {
      options[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return options;
}

/**
 * 선형 보간 백분위수.
 *
 * @param sorted   오름차순 배열
 * @param fraction 0~1
 * @returns 값 (빈 배열이면 null)
 */
function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * 숫자 배열 요약.
 *
 * @param values 숫자 목록 (null/NaN은 제외)
 * @returns n/p50/p95/min/max (소수 둘째 자리 반올림)
 */
function summarize(values) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  const sorted = [...clean].sort((left, right) => left - right);
  const round = (value) => (value == null ? null : Math.round(value * 100) / 100);
  return {
    n: sorted.length,
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    min: round(sorted[0] ?? null),
    max: round(sorted.at(-1) ?? null),
  };
}

/**
 * 샘플 목록에서 지표별 요약을 만든다.
 *
 * @param samples 샘플 배열 (각 샘플은 평탄한 숫자 필드를 가진 객체)
 * @returns 지표명 → 요약
 */
function summarizeSamples(samples) {
  const keys = new Set();
  for (const sample of samples) {
    for (const [key, value] of Object.entries(sample.metrics)) {
      if (typeof value === 'number') keys.add(key);
    }
  }
  return Object.fromEntries(
    [...keys].sort().map((key) => [key, summarize(samples.map((sample) => sample.metrics[key]))]),
  );
}

// ---------------------------------------------------------------------------------------------
// Vite / 브라우저 수명주기
// ---------------------------------------------------------------------------------------------

/**
 * 포트가 사용 중인지 확인한다 (IPv4/IPv6 loopback 모두).
 *
 * @param port 포트 번호
 * @returns 사용 중이면 true
 */
async function isPortBusy(port) {
  const tryConnect = (host) =>
    new Promise((resolvePromise) => {
      const socket = net.connect({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.once('error', () => resolvePromise(false));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolvePromise(false);
      });
    });
  return (await tryConnect('127.0.0.1')) || (await tryConnect('::1'));
}

/**
 * Vite 개발 서버를 기동한다. 출력은 크기 제한이 있는 임시 로그 파일에만 남긴다.
 *
 * @param port   포트
 * @param logDir 로그 디렉터리
 * @returns 자식 프로세스
 */
function startVite(port, logDir) {
  const log = createWriteStream(join(logDir, 'vite.log'), { flags: 'w', mode: 0o600 });
  let written = 0;
  const child = spawn('npm', ['run', 'local', '--', '--port', String(port)], {
    cwd: clientDir,
    detached: true,
    env: {
      ...process.env,
      VITE_ERD_PERF_PROBE: 'true',
      VITE_DEV_SERVER_PORT: String(port),
      VITE_DEV_SERVER_STRICT_PORT: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sink = (chunk) => {
    if (written >= VITE_LOG_MAX_BYTES) return;
    const slice = chunk.subarray(0, VITE_LOG_MAX_BYTES - written);
    written += slice.length;
    log.write(slice);
  };
  child.stdout.on('data', sink);
  child.stderr.on('data', sink);
  child.once('exit', () => log.end());
  child.once('error', () => log.end());
  return child;
}

/**
 * Vite 프로세스 그룹을 종료한다.
 *
 * @param child 자식 프로세스
 */
async function stopVite(child) {
  if (!child || child.exitCode != null) return;
  try {
    process.kill(-child.pid, 'SIGINT');
  } catch {
    child.kill('SIGINT');
  }
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 8000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
  if (child.exitCode == null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

/**
 * 서버가 응답할 때까지 기다린다.
 *
 * @param url   확인 URL
 * @param child 자식 프로세스 (조기 종료 감지용, 선택)
 */
async function waitForServer(url, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode != null) throw new Error('Vite exited before becoming reachable');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // 재시도
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
  throw new Error(`Server did not become reachable: ${url}`);
}

/**
 * Chromium 실행 파일 경로를 결정한다. playwright 기본 브라우저가 없으면 캐시된 chromium-*를 찾는다.
 *
 * @param explicit --chromium-path 값
 * @returns 실행 파일 경로 또는 undefined(= playwright 기본 사용)
 */
function resolveChromiumPath(explicit) {
  if (explicit) return explicit;
  const defaultPath = chromium.executablePath();
  if (defaultPath && existsSync(defaultPath)) return undefined;
  const cacheRoot = join(os.homedir(), 'Library/Caches/ms-playwright');
  const linuxRoot = join(os.homedir(), '.cache/ms-playwright');
  for (const root of [cacheRoot, linuxRoot]) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const candidates = [
        join(root, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(root, dir, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(root, dir, 'chrome-linux/chrome'),
      ];
      const found = candidates.find((candidate) => existsSync(candidate));
      if (found) return found;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// 페이지에 주입하는 계측 (addInitScript)
// ---------------------------------------------------------------------------------------------

/**
 * 모든 문서 로드 전에 실행되는 초기화 스크립트.
 * probe 활성화, 시드 주입, longtask/event 관찰자, autosave 쓰기 추적, React DevTools hook(렌더 카운터)을 설치한다.
 *
 * @param args `{ json, key }` — 시드 JSON과 localStorage 키
 */
function pageInit({ json, key }) {
  window.__ERD_PERF_PROBE_ENABLE__ = true;
  try {
    localStorage.setItem(key, json);
    localStorage.setItem('i18nextLng', 'en');
  } catch {
    return; // about:blank 등 storage 불가 문서
  }
  const B = (window.__B = { longtasks: [], events: [], saves: [], win: null, onSave: null });
  try {
    B.lo = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) B.longtasks.push({ s: entry.startTime, d: entry.duration });
    });
    B.lo.observe({ type: 'longtask', buffered: true });
  } catch {
    B.lo = null;
  }
  try {
    B.eo = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        B.events.push({ name: entry.name, s: entry.startTime, dur: entry.duration });
      }
    });
    B.eo.observe({ type: 'event', durationThreshold: 16 });
  } catch {
    B.eo = null;
  }

  // autosave(5s tick) 쓰기 추적: 키가 일치하는 setItem만 기록한다.
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(k, v) {
    const t0 = performance.now();
    const result = originalSetItem.call(this, k, v);
    if (k === key) {
      B.saves.push({ t: t0, d: performance.now() - t0, chars: String(v).length });
      if (B.onSave) B.onSave();
    }
    return result;
  };

  /** longtask/event 관찰자의 미전달 레코드를 즉시 비운다. */
  B.flush = () => {
    for (const entry of B.lo?.takeRecords() ?? []) B.longtasks.push({ s: entry.startTime, d: entry.duration });
    for (const entry of B.eo?.takeRecords() ?? []) {
      B.events.push({ name: entry.name, s: entry.startTime, dur: entry.duration });
    }
  };
  /** 마지막 활동(longtask 끝 / DOM 변이) 이후 경과 시간(ms). */
  B.idleMs = () => {
    B.flush();
    let last = 0;
    for (const task of B.longtasks) last = Math.max(last, task.s + task.d);
    if (B.win) last = Math.max(last, B.win.domLast);
    return performance.now() - last;
  };
  /** 다음 autosave 쓰기까지 대기한다. */
  B.nextSave = (timeoutMs) =>
    new Promise((resolvePromise) => {
      const timer = setTimeout(() => {
        B.onSave = null;
        resolvePromise('timeout');
      }, timeoutMs);
      B.onSave = () => {
        B.onSave = null;
        clearTimeout(timer);
        setTimeout(() => resolvePromise('saved'), 120);
      };
    });
  /** 측정 창을 연다. */
  B.begin = (types) => {
    B.flush();
    const w = {
      start: performance.now(),
      evs: [],
      domCount: 0,
      domLast: 0,
      saveStart: B.saves.length,
      eventStart: B.events.length,
      types,
    };
    w.handler = (event) => {
      const record = { type: event.type, t: event.timeStamp, lat: null };
      w.evs.push(record);
      requestAnimationFrame(() => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          record.lat = performance.now() - record.t;
          channel.port1.close();
        };
        channel.port2.postMessage(0);
      });
    };
    for (const type of types) window.addEventListener(type, w.handler, true);
    const root = document.querySelector('.react-flow');
    w.mo = new MutationObserver((records) => {
      w.domCount += records.length;
      w.domLast = performance.now();
    });
    if (root) w.mo.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    B.win = w;
  };
  /** 측정 창을 닫고 원시 결과를 돌려준다. */
  B.end = () => {
    const w = B.win;
    B.flush();
    for (const type of w.types) window.removeEventListener(type, w.handler, true);
    w.mo.takeRecords().forEach(() => (w.domCount += 1));
    w.mo.disconnect();
    B.win = null;
    const endAt = performance.now();
    return {
      start: w.start,
      end: endAt,
      evs: w.evs,
      domCount: w.domCount,
      domLast: w.domLast,
      longtasks: B.longtasks.filter((task) => task.s >= w.start - 1).map((task) => ({ s: task.s, d: task.d })),
      eventTiming: B.events.slice(w.eventStart),
      saves: B.saves.slice(w.saveStart),
    };
  };

  // React DevTools hook: 커밋 단위 렌더 카운터 (RS.on === true 일 때만 fiber를 순회한다)
  const RS = (window.__RS = { on: false, commits: 0, renders: {}, mounts: {}, total: 0 });
  const componentName = (type) => {
    if (!type) return null;
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (type.render) return type.render.displayName || type.render.name || type.displayName || null;
    if (type.type) return componentName(type.type);
    return type.displayName || null;
  };
  const COMPONENT_TAGS = new Set([0, 1, 11, 15]); // Function, Class, ForwardRef, SimpleMemo
  const walk = (start) => {
    const stack = [start];
    while (stack.length) {
      let fiber = stack.pop();
      while (fiber) {
        const alt = fiber.alternate;
        if (COMPONENT_TAGS.has(fiber.tag)) {
          const name = componentName(fiber.type) || 'Anonymous';
          if (!alt) {
            RS.mounts[name] = (RS.mounts[name] ?? 0) + 1;
          } else if (fiber.flags & 1) {
            RS.renders[name] = (RS.renders[name] ?? 0) + 1;
            RS.total += 1;
          }
        }
        if (fiber.child && (!alt || fiber.child !== alt.child)) stack.push(fiber.child);
        fiber = fiber.sibling;
      }
    }
  };
  RS.reset = () => {
    RS.commits = 0;
    RS.renders = {};
    RS.mounts = {};
    RS.total = 0;
  };
  const hook = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) {
      const id = hook.renderers.size + 1;
      hook.renderers.set(id, renderer);
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      if (!RS.on) return;
      RS.commits += 1;
      try {
        walk(root.current);
      } catch {
        // 계측 실패는 무시 (렌더 카운트만 비게 된다)
      }
    },
    onPostCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    checkDCE() {},
  };
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
}

// ---------------------------------------------------------------------------------------------
// 페이지 수명주기 / 측정 창
// ---------------------------------------------------------------------------------------------

/**
 * 페이지가 정착할 때까지(longtask 없음) 기다린다.
 *
 * @param page   Playwright Page
 * @param quietMs 요구 무활동 시간
 * @param maxMs   최대 대기
 */
async function waitQuiet(page, quietMs = 800, maxMs = 90_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const idle = await page.evaluate(() => window.__B.idleMs());
    if (idle >= quietMs) return idle;
    await page.waitForTimeout(150);
  }
  return -1;
}

/**
 * 시드를 로드하고 앱이 N개 노드와 E개 엣지를 모두 렌더링할 때까지 기다린다.
 *
 * @param browser    Playwright Browser
 * @param baseUrl    서버 URL
 * @param seed       시드 객체
 * @param headedFlag 미사용 (자리 표시)
 * @returns `{ context, page, cdp, loadMs, loadLongTaskMs, loadLongTasks }`
 */
async function openSeededPage(browser, baseUrl, seed) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
  });
  await context.addInitScript(pageInit, { json: seed.json, key: DRAFT_KEY });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.message).slice(0, 200)));
  const started = Date.now();
  await page.goto(new URL('/erd-local', baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    ({ nodes, edges }) =>
      document.querySelectorAll('.react-flow__node').length >= nodes &&
      document.querySelectorAll('.react-flow__edge').length >= edges,
    { nodes: seed.meta.tables, edges: seed.meta.edges },
    { timeout: 300_000, polling: 200 },
  );
  const loadMs = Date.now() - started;
  await waitQuiet(page, 1500, 120_000);
  const loadLongTasks = await page.evaluate(() => {
    window.__B.flush();
    const tasks = window.__B.longtasks;
    return {
      count: tasks.length,
      totalMs: Math.round(tasks.reduce((sum, task) => sum + task.d, 0)),
      maxMs: Math.round(tasks.reduce((max, task) => Math.max(max, task.d), 0)),
    };
  });
  // 인앱 probe는 DiagramPage에서만 navigation origin을 설정한다. erd-local에서는 같은 모듈 인스턴스를
  // 동적 import해 하네스 쪽에서 설정한다 (제품 코드 수정 없음).
  const probeReady = await page.evaluate(async () => {
    const probe = await import('/src/lib/erd-performance-probe.ts');
    probe.probeSetNavigationOrigin();
    return typeof window.__ERD_PERF_SNAPSHOT__ === 'function';
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  return { context, page, cdp, loadMs, loadLongTasks, probeReady, pageErrors };
}

/**
 * CDP Performance 메트릭을 이름→값 맵으로 읽는다.
 *
 * @param cdp CDP 세션
 * @returns 메트릭 맵
 */
async function readCdpMetrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
}

/**
 * probe 카운터를 읽는다.
 *
 * @param page Playwright Page
 * @returns 카운터 맵 (없으면 빈 객체)
 */
async function readProbeCounters(page) {
  return page.evaluate(() => window.__ERD_PERF_SNAPSHOT__?.().counters ?? {});
}

/**
 * 두 카운터 스냅샷의 변화량을 구한다 (변한 것만).
 *
 * @param before 이전
 * @param after  이후
 * @returns `probe.<name>.calls` / `probe.<name>.totalMs` 평탄 객체
 */
function diffCounters(before, after) {
  const out = {};
  for (const [name, value] of Object.entries(after)) {
    const prev = before[name] ?? { calls: 0, totalMs: 0, maxMs: 0 };
    const calls = value.calls - prev.calls;
    const totalMs = value.totalMs - prev.totalMs;
    if (calls !== 0) out[`probe.${name}.calls`] = calls;
    if (Math.abs(totalMs) > 0.001) out[`probe.${name}.totalMs`] = Math.round(totalMs * 100) / 100;
  }
  return out;
}

/**
 * CDP CPU 프로파일을 self-time 기준 상위 함수/파일로 요약한다.
 *
 * @param profile `Profiler.stop` 결과의 profile
 * @returns `{ totalMs, topFunctions, topFiles }`
 */
function summarizeCpuProfile(profile) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfUs = new Map();
  profile.samples.forEach((nodeId, index) => {
    selfUs.set(nodeId, (selfUs.get(nodeId) ?? 0) + (profile.timeDeltas[index] ?? 0));
  });
  const shortUrl = (url) => {
    if (!url) return '(native)';
    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname).replace(/^\/node_modules\/\.vite\/deps\//, 'deps/');
    } catch {
      return url;
    }
  };
  const byFunction = new Map();
  const byFile = new Map();
  let totalUs = 0;
  for (const [nodeId, us] of selfUs) {
    const frame = byId.get(nodeId).callFrame;
    const file = shortUrl(frame.url);
    const fnKey = `${frame.functionName || '(anonymous)'} @ ${file}:${frame.lineNumber + 1}`;
    byFunction.set(fnKey, (byFunction.get(fnKey) ?? 0) + us);
    byFile.set(file, (byFile.get(file) ?? 0) + us);
    totalUs += us;
  }
  const top = (map, count) =>
    [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, count)
      .map(([name, us]) => ({ name, selfMs: Math.round(us / 100) / 10, pct: Math.round((us / totalUs) * 1000) / 10 }));
  // 자기 시간 상위 5개 함수의 직접 호출자(부모 프레임)를 집계한다 — 네이티브 함수(querySelector 등)의 출처 추적용.
  const parentOf = new Map();
  for (const node of profile.nodes) for (const childId of node.children ?? []) parentOf.set(childId, node.id);
  const topNames = new Set(top(byFunction, 5).map((entry) => entry.name));
  const callers = {};
  for (const [nodeId, us] of selfUs) {
    const frame = byId.get(nodeId).callFrame;
    const name = `${frame.functionName || '(anonymous)'} @ ${shortUrl(frame.url)}:${frame.lineNumber + 1}`;
    if (!topNames.has(name)) continue;
    const parent = byId.get(parentOf.get(nodeId));
    const parentFrame = parent?.callFrame;
    const parentName = parentFrame
      ? `${parentFrame.functionName || '(anonymous)'} @ ${shortUrl(parentFrame.url)}:${parentFrame.lineNumber + 1}`
      : '(root)';
    callers[name] ??= new Map();
    callers[name].set(parentName, (callers[name].get(parentName) ?? 0) + us);
  }
  const callerSummary = Object.fromEntries(
    Object.entries(callers).map(([name, map]) => [
      name,
      [...map.entries()].sort((l, r) => r[1] - l[1]).slice(0, 6).map(([caller, us]) => ({ caller, selfMs: Math.round(us / 100) / 10 })),
    ]),
  );
  return { totalMs: Math.round(totalUs / 100) / 10, topFunctions: top(byFunction, 25), topFiles: top(byFile, 15), callers: callerSummary };
}

/**
 * 측정 창 하나를 실행한다.
 *
 * @param ctx      실행 컨텍스트 (`page`, `cdp`)
 * @param types    지연을 기록할 입력 이벤트 타입
 * @param primary  주 이벤트 타입 목록 (inputToFrame 계산 대상)
 * @param fn       창 안에서 수행할 입력 동작
 * @param opts     `{ fixedWindowMs, renderPass }`
 * @returns 샘플 `{ metrics, extra }` 또는 renderPass면 렌더 통계
 */
async function measureWindow(ctx, types, primary, fn, opts = {}) {
  const { page, cdp } = ctx;
  await waitQuiet(page, 400, 30_000);
  const countersBefore = await readProbeCounters(page);
  const cdpBefore = await readCdpMetrics(cdp);
  if (opts.profile) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    await cdp.send('Profiler.start');
  }
  if (opts.renderPass) await page.evaluate(() => { window.__RS.reset(); window.__RS.on = true; });
  await page.evaluate((list) => window.__B.begin(list), types);
  const wallStart = Date.now();
  await fn();
  let capped = false;
  if (opts.fixedWindowMs) {
    await page.waitForTimeout(opts.fixedWindowMs);
  } else {
    await page.waitForTimeout(SETTLE_MIN_MS);
    for (;;) {
      const idle = await page.evaluate(() => window.__B.idleMs());
      if (idle >= SETTLE_QUIET_MS) break;
      if (Date.now() - wallStart > (opts.settleMaxMs ?? SETTLE_MAX_MS)) {
        capped = true;
        break;
      }
      await page.waitForTimeout(100);
    }
  }
  const raw = await page.evaluate(() => window.__B.end());
  if (opts.profile) {
    const { profile } = await cdp.send('Profiler.stop');
    await cdp.send('Profiler.disable');
    return { profile: summarizeCpuProfile(profile), settleCapped: capped };
  }
  if (opts.renderPass) {
    return page.evaluate(() => {
      window.__RS.on = false;
      const { commits, total, renders, mounts } = window.__RS;
      const top = (map) =>
        Object.entries(map)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 12);
      return {
        commits,
        componentRenders: total,
        componentMounts: Object.values(mounts).reduce((sum, count) => sum + count, 0),
        topRenders: top(renders),
        topMounts: top(mounts),
        TableNodeRenders: renders.TableNode ?? 0,
        TableNodeMounts: mounts.TableNode ?? 0,
        ErdRelationEdgeRenders: renders.ErdRelationEdge ?? 0,
        settleCapped: undefined,
      };
    });
  }
  const cdpAfter = await readCdpMetrics(cdp);
  const countersAfter = await readProbeCounters(page);

  const delta = (name) => ((cdpAfter[name] ?? 0) - (cdpBefore[name] ?? 0)) * 1000;
  const primaryEvents = raw.evs.filter((event) => primary.includes(event.type));
  const latencies = primaryEvents.map((event) => event.lat).filter((value) => value != null);
  const firstPrimary = primaryEvents[0];
  const lastLongTaskEnd = raw.longtasks.reduce((max, task) => Math.max(max, task.s + task.d), 0);
  const lastActivity = Math.max(lastLongTaskEnd, raw.domLast, raw.start);
  const longTaskDurations = raw.longtasks.map((task) => task.d);
  const metrics = {
    inputToFrameMs: latencies.length ? Math.max(...latencies) : null,
    inputToFrameFirstMs: latencies.length ? latencies[0] : null,
    settleMs: firstPrimary ? Math.max(0, lastActivity - firstPrimary.t) : null,
    longTaskCount: longTaskDurations.length,
    longTaskTotalMs: Math.round(longTaskDurations.reduce((sum, value) => sum + value, 0) * 10) / 10,
    longTaskMaxMs: Math.round(Math.max(0, ...longTaskDurations) * 10) / 10,
    taskMs: Math.round(delta('TaskDuration') * 10) / 10,
    scriptMs: Math.round(delta('ScriptDuration') * 10) / 10,
    layoutMs: Math.round(delta('LayoutDuration') * 10) / 10,
    styleMs: Math.round(delta('RecalcStyleDuration') * 10) / 10,
    layoutCount: Math.round(delta('LayoutCount') / 1000),
    styleRecalcCount: Math.round(delta('RecalcStyleCount') / 1000),
    domMutations: raw.domCount,
    eventTimingMaxMs: raw.eventTiming.length ? Math.max(...raw.eventTiming.map((entry) => entry.dur)) : 0,
    autosaveWrites: raw.saves.length,
    windowMs: Math.round(raw.end - raw.start),
    settleCapped: capped ? 1 : 0,
    ...diffCounters(countersBefore, countersAfter),
  };
  const dropEvent = raw.evs.find((event) => event.type === 'pointerup');
  if (dropEvent && dropEvent.lat != null && primary.includes('pointermove')) {
    metrics.dropToFrameMs = dropEvent.lat;
  }
  return { metrics, extra: { perEventLatencyMs: raw.evs.map((e) => [e.type, e.lat != null ? Math.round(e.lat * 10) / 10 : null]).slice(0, 40) } };
}

// ---------------------------------------------------------------------------------------------
// 화면 상호작용 헬퍼
// ---------------------------------------------------------------------------------------------

/**
 * 노드 요소의 화면 좌표를 읽는다.
 *
 * @param page   Playwright Page
 * @param nodeId 노드 ID
 * @returns `{x,y,w,h}` 또는 null
 */
async function nodeBox(page, nodeId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  }, nodeId);
}

/**
 * 뷰포트 중앙에 가장 가까운 노드를 찾는다.
 *
 * @param page Playwright Page
 * @returns `{ id, x, y }` (화면 중심 좌표)
 */
async function pickCenterNode(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow').getBoundingClientRect();
    const cx = pane.x + pane.width / 2;
    const cy = pane.y + pane.height / 2;
    let best = null;
    for (const el of document.querySelectorAll('.react-flow__node')) {
      const rect = el.getBoundingClientRect();
      const distance = Math.hypot(rect.x + rect.width / 2 - cx, rect.y + rect.height / 2 - cy);
      if (!best || distance < best.distance) {
        best = { distance, id: el.getAttribute('data-id'), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
    }
    return best;
  });
}

/**
 * 대상 노드를 가운데에 둔 채 휠로 확대해 테이블 폭이 충분히 커지게 한다.
 *
 * @param page   Playwright Page
 * @param target `{ id, x, y }`
 * @returns 확대 후 노드 박스
 */
async function zoomToNode(page, target) {
  await page.mouse.move(target.x, target.y);
  let box = await nodeBox(page, target.id);
  for (let step = 0; step < 10 && box && box.w < 380; step += 1) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(220);
    box = await nodeBox(page, target.id);
  }
  await page.waitForTimeout(400);
  return nodeBox(page, target.id);
}

/**
 * 헤더 중앙을 클릭해 테이블을 선택(편집 모드)한다.
 *
 * @param page Playwright Page
 * @param id   노드 ID
 */
async function clickNodeHeader(page, id) {
  const box = await nodeBox(page, id);
  if (!box) throw new Error(`node ${id} not found`);
  await page.mouse.click(box.x + box.w / 2, box.y + 14);
}

/**
 * 엣지 위의 실제로 클릭 가능한 화면 좌표를 찾는다.
 *
 * @param page   Playwright Page
 * @param edgeId 엣지 ID
 * @returns `{x,y}` 또는 null
 */
async function findEdgeClickPoint(page, edgeId) {
  return page.evaluate((id) => {
    const group = document.querySelector(`.react-flow__edge[data-id="${id}"]`);
    if (!group) return null;
    const path = group.querySelector('path.react-flow__edge-interaction') ?? group.querySelector('path');
    if (!path) return null;
    const length = path.getTotalLength();
    const matrix = path.getScreenCTM();
    const pane = document.querySelector('.react-flow').getBoundingClientRect();
    for (const fraction of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8, 0.15, 0.85, 0.1, 0.9, 0.05, 0.95]) {
      const point = path.getPointAtLength(length * fraction);
      const x = matrix.a * point.x + matrix.c * point.y + matrix.e;
      const y = matrix.b * point.x + matrix.d * point.y + matrix.f;
      if (x < pane.x + 5 || x > pane.right - 5 || y < pane.y + 60 || y > pane.bottom - 5) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && group.contains(hit)) return { x, y };
    }
    return null;
  }, edgeId);
}

// ---------------------------------------------------------------------------------------------
// 시나리오 정의
// ---------------------------------------------------------------------------------------------

/**
 * 시나리오 목록. `run(ctx, i, measure)`에서 `measure(subId, types, primary, fn)`로 측정 창을 연다.
 * 창 밖의 준비/정리는 측정에 포함되지 않는다.
 */
const SCENARIOS = [
  {
    key: 'idle',
    label: '유휴 기준선 (입력 없음, autosave 5초 tick 포함)',
    subs: ['idle'],
    async run(ctx, _i, measure) {
      await measure('idle', [], [], async () => {}, { fixedWindowMs: IDLE_WINDOW_MS });
    },
  },
  {
    key: 'a',
    label: '(a) 컬럼 이름 한 글자 입력',
    subs: ['a-rename-column'],
    async prepare(ctx) {
      ctx.renameInput = ctx.page.locator(`.react-flow__node[data-id="${ctx.target.id}"] input[aria-label="Column name"]`).nth(4);
    },
    async run(ctx, _i, measure) {
      await ctx.renameInput.focus();
      await measure('a-rename-column', ['keydown'], ['keydown'], () => ctx.page.keyboard.type('x'));
    },
  },
  {
    key: 'b',
    label: '(b) 컬럼 1개 추가 (Add Column 클릭)',
    subs: ['b-add-column'],
    async run(ctx, _i, measure) {
      const addButton = ctx.page.getByRole('button', { name: 'Add Column' }).first();
      await measure('b-add-column', ['click'], ['click'], () => addButton.click({ timeout: 90_000 }));
      // 정리(측정 밖): 방금 추가한 컬럼을 지워 노드 크기를 일정하게 유지
      await ctx.page
        .locator(`.react-flow__node[data-id="${ctx.target.id}"] button[aria-label^="Delete column"]`)
        .last()
        .click({ timeout: 90_000 });
    },
  },
  {
    key: 'c',
    label: '(c) 노드 1개 드래그 (≈60px, 10 move)',
    subs: ['c-drag-node'],
    async run(ctx, i, measure) {
      const box = await nodeBox(ctx.page, ctx.target.id);
      const direction = i % 2 === 0 ? 1 : -1;
      const startX = box.x + box.w / 2;
      const startY = box.y + 14;
      const orderBefore = await ctx.page.evaluate(async (id) => {
        const { default: store } = await import('/src/stores/useCanvasStore.ts');
        const ids = store.getState().nodes.map((node) => node.id);
        return { index: ids.indexOf(id), total: ids.length };
      }, ctx.target.id);
      await measure('c-drag-node', ['pointerdown', 'pointermove', 'pointerup'], ['pointermove'], async () => {
        await ctx.page.mouse.move(startX, startY);
        await ctx.page.mouse.down();
        await ctx.page.mouse.move(startX + 64 * direction, startY + 32 * direction, { steps: 10 });
        await ctx.page.mouse.up();
      });
      const orderAfter = await ctx.page.evaluate(async (id) => {
        const { default: store } = await import('/src/stores/useCanvasStore.ts');
        const ids = store.getState().nodes.map((node) => node.id);
        return { index: ids.indexOf(id), total: ids.length };
      }, ctx.target.id);
      ctx.notes.push({ scenario: 'c', iteration: i, nodeIndexBefore: orderBefore.index, nodeIndexAfter: orderAfter.index, total: orderAfter.total });
    },
  },
  {
    key: 'd',
    label: '(d) 엣지 추가(FK Connect) / 삭제(Keep FK)',
    subs: ['d1-edge-add', 'd2-edge-delete'],
    async run(ctx, i, measure) {
      const { page } = ctx;
      const candidates = ctx.edgeNeighbors;
      if (!candidates?.length) throw new Error('no neighbor node available for edge scenario');
      const child = candidates[i % candidates.length];
      const parent = ctx.target.id;
      const before = await page.evaluate(() => Array.from(document.querySelectorAll('.react-flow__edge')).map((e) => e.getAttribute('data-id')));
      ctx.phase = `iter ${i}: FK Connect toggle`;
      await page.getByRole('button', { name: /FK Connect/ }).click();
      ctx.phase = `iter ${i}: click parent header`;
      await clickNodeHeader(page, parent);
      ctx.phase = `iter ${i}: click child header`;
      await clickNodeHeader(page, child);
      ctx.phase = `iter ${i}: wait FK type dialog`;
      const typeButton = page.getByRole('button', { name: 'Non-identifying' });
      await typeButton.waitFor({ state: 'visible', timeout: 90_000 });
      ctx.phase = `iter ${i}: measure d1`;
      await measure('d1-edge-add', ['click'], ['click'], () => typeButton.click({ timeout: 90_000 }));
      ctx.phase = `iter ${i}: locate added edge`;
      await page.waitForTimeout(300);
      // 새 엣지 ID는 시드의 `e-...` 형식이 아니라 stable ID(`rel:parent.col->child.col`)로 생성되므로, 이전 DOM과의 차집합으로 찾는다.
      const added = await page.evaluate(
        (prev) =>
          Array.from(document.querySelectorAll('.react-flow__edge'))
            .map((e) => e.getAttribute('data-id'))
            .filter((id) => !prev.includes(id)),
        before,
      );
      if (added.length === 0) {
        const diff = await page.evaluate(
          (prev) => Array.from(document.querySelectorAll('.react-flow__edge')).map((e) => e.getAttribute('data-id')).filter((id) => !prev.includes(id)),
          before,
        );
        throw new Error(`added edge not found in DOM (parent=${parent} child=${child} newEdgeIds=${JSON.stringify(diff.slice(0, 3))} edgeCount=${before.length}->${before.length + diff.length})`);
      }
      const point = await findEdgeClickPoint(page, added[0]);
      if (point) {
        await page.mouse.click(point.x, point.y);
      } else {
        // 편집 모드 테이블에 가려 실제 클릭 지점을 못 찾는 경우: 엣지 요소에 click 이벤트를 직접 전달한다 (React onEdgeClick 경로는 동일).
        ctx.notes.push({ scenario: 'd', iteration: i, edgeClick: 'synthetic-dispatch' });
        await page.evaluate((id) => {
          const group = document.querySelector(`.react-flow__edge[data-id="${id}"]`);
          const path = group.querySelector('path.react-flow__edge-interaction') ?? group.querySelector('path');
          path.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }, added[0]);
      }
      ctx.phase = `iter ${i}: press Delete`;
      await page.keyboard.press('Delete');
      ctx.phase = `iter ${i}: wait Keep FK dialog`;
      const keepButton = page.getByRole('button', { name: 'Keep FK' });
      await keepButton.waitFor({ state: 'visible', timeout: 90_000 });
      ctx.phase = `iter ${i}: measure d2`;
      await measure('d2-edge-delete', ['click'], ['click'], () => keepButton.click({ timeout: 90_000 }));
    },
  },
];

/**
 * 인접 노드 후보(좌우)를 고른다: 화면에 완전히 보이고, 시드상 대상과 엣지가 없는 노드.
 *
 * @param page    Playwright Page
 * @param seed    시드
 * @param target  대상 노드 `{id}`
 * @returns 후보 노드 ID 목록
 */
async function pickEdgeNeighbors(page, seed, target) {
  const connected = new Set();
  for (const edge of seed.edges) {
    if (edge.source === target.id) connected.add(edge.target);
    if (edge.target === target.id) connected.add(edge.source);
  }
  const visible = await page.evaluate(({ id }) => {
    const pane = document.querySelector('.react-flow').getBoundingClientRect();
    const targetEl = document.querySelector(`.react-flow__node[data-id="${id}"]`).getBoundingClientRect();
    const out = [];
    for (const el of document.querySelectorAll('.react-flow__node')) {
      const nodeId = el.getAttribute('data-id');
      if (nodeId === id) continue;
      const rect = el.getBoundingClientRect();
      const headerX = rect.x + rect.width / 2;
      const headerY = rect.y + 14;
      if (headerX < pane.x + 10 || headerX > pane.right - 10 || headerY < pane.y + 70 || headerY > pane.bottom - 10) continue;
      out.push({ id: nodeId, d: Math.hypot(headerX - (targetEl.x + targetEl.width / 2), headerY - (targetEl.y + 14)) });
    }
    return out.sort((l, r) => l.d - r.d);
  }, { id: target.id });
  return visible.filter((node) => !connected.has(node.id)).map((node) => node.id).slice(0, 3);
}

// ---------------------------------------------------------------------------------------------
// H8 / 마이크로 벤치 (페이지 안에서 실제 앱 함수를 호출)
// ---------------------------------------------------------------------------------------------

/**
 * H8 증거: 렌더된 노드/엣지 수와 뷰포트 안에 실제로 보이는 수를 센다.
 *
 * @param page Playwright Page
 * @returns 카운트 객체
 */
async function measureViewportCulling(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow').getBoundingClientRect();
    const intersects = (rect) => rect.right > pane.x && rect.x < pane.right && rect.bottom > pane.y && rect.y < pane.bottom;
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    const edges = Array.from(document.querySelectorAll('.react-flow__edge'));
    return {
      domNodes: nodes.length,
      visibleNodes: nodes.filter((el) => intersects(el.getBoundingClientRect())).length,
      domEdges: edges.length,
      visibleEdges: edges.filter((el) => intersects(el.getBoundingClientRect())).length,
      totalDomElements: document.getElementsByTagName('*').length,
    };
  });
}

/**
 * H1/H2 단위 비용 마이크로 벤치.
 * erd-local에는 협업 런타임(문서 세션/persistence coordinator)이 없으므로 전체 경로 대신,
 * 해당 경로가 호출하는 실제 앱 함수를 라이브 Y.Doc/스토어에 대해 직접 반복 호출한다.
 *
 * @param page Playwright Page
 * @returns 단위 비용(ms) 통계
 */
async function measureMicro(page) {
  return page.evaluate(async () => {
    const REPS = 7;
    const stats = (values) => {
      const sorted = [...values].sort((l, r) => l - r);
      const at = (f) => sorted[Math.min(sorted.length - 1, Math.round((sorted.length - 1) * f))];
      return { n: sorted.length, p50: Math.round(at(0.5) * 100) / 100, max: Math.round(sorted.at(-1) * 100) / 100 };
    };
    const { default: store } = await import('/src/stores/useCanvasStore.ts');
    const { YjsSharedDocumentEngine } = await import('/src/collaboration/core/engines/yjs-shared-document-engine.ts');
    const { createErdDocumentPlugin } = await import('/src/collaboration/plugins/erd/erd-document-plugin.ts');
    const { buildRevisionHash } = await import('/src/lib/code-sync-revision.ts');
    const state = store.getState();
    const doc = state.ydoc;
    if (!doc) return { error: 'ydoc not available' };
    const engine = new YjsSharedDocumentEngine(doc);
    const serializer = createErdDocumentPlugin().createArtifactSerializer({});
    const encode = [];
    const build = [];
    let snapshotBytes = 0;
    let artifactBytes = 0;
    for (let rep = 0; rep < REPS; rep += 1) {
      const t0 = performance.now();
      const raw = engine.exportSnapshot();
      const t1 = performance.now();
      const artifact = serializer.build(raw);
      const t2 = performance.now();
      encode.push(t1 - t0);
      build.push(t2 - t1);
      snapshotBytes = raw.length;
      artifactBytes = artifact?.length ?? 0;
    }
    const nodes = state.nodes;
    const edges = state.edges;
    const hash = [];
    for (let rep = 0; rep < REPS; rep += 1) {
      const t0 = performance.now();
      buildRevisionHash(
        nodes.map((node) => ({ id: node.id, type: node.type ?? 'table', parentId: node.parentId ?? null, data: node.data })),
        edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          type: edge.type ?? 'default',
          data: edge.data,
        })),
      );
      hash.push(performance.now() - t0);
    }
    const serialize = [];
    for (let rep = 0; rep < REPS; rep += 1) {
      const t0 = performance.now();
      store.getState().serialize();
      serialize.push(performance.now() - t0);
    }
    return {
      reps: REPS,
      h1_encodeStateAsUpdate_ms: stats(encode),
      h1_applyToNewDoc_plus_yDocToJson_ms: stats(build),
      h1_snapshotBytes: snapshotBytes,
      h1_artifactBytes: artifactBytes,
      h2_buildRevisionHash_ms: stats(hash),
      localAutosave_serialize_ms: stats(serialize),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// 실행기
// ---------------------------------------------------------------------------------------------

/**
 * 시나리오 하나를 새 페이지에서 실행하고 결과를 `result.scenarios`에 채운다.
 *
 * @param browser  Playwright Browser
 * @param baseUrl  서버 URL
 * @param seed     시드
 * @param scenario 시나리오 정의
 * @param options  실행 옵션
 * @param result   크기별 결과 객체 (여기에 기록)
 * @param holder   `{ opened, ctx }` — 타임아웃 시 정리/진단용 참조
 */
async function runScenario(browser, baseUrl, seed, scenario, options, result, holder) {
  const opened = await openSeededPage(browser, baseUrl, seed);
  holder.opened = opened;
  const { page } = opened;
  const ctx = { page, cdp: opened.cdp, notes: [], target: null, edgeNeighbors: [], phase: 'setup' };
  holder.ctx = ctx;
  ctx.target = await pickCenterNode(page);
  if (scenario.key !== 'idle') {
    ctx.phase = 'zoom';
    ctx.zoomedBox = await zoomToNode(page, ctx.target);
    await waitQuiet(page, 1000, 60_000);
    ctx.phase = 'select target table';
    await clickNodeHeader(page, ctx.target.id);
    await waitQuiet(page, 1000, 60_000);
    ctx.edgeNeighbors = scenario.key === 'd' ? await pickEdgeNeighbors(page, seed, ctx.target) : [];
    await scenario.prepare?.(ctx);
  }
  const bySub = Object.fromEntries(scenario.subs.map((sub) => [sub, { samples: [], renderCounts: null, extra: [] }]));
  /** 지금까지 모인 샘플로 결과를 확정한다 (타임아웃/오류 시에는 부분 결과로 기록). */
  holder.finalize = (failure) => {
    for (const sub of scenario.subs) {
      result.scenarios[sub] = {
        label: scenario.label,
        iterations: bySub[sub].samples.length,
        summary: summarizeSamples(bySub[sub].samples),
        renderCounts: bySub[sub].renderCounts,
        ...(bySub[sub].profile ? { cpuProfile: bySub[sub].profile } : {}),
        samples: bySub[sub].samples,
        ...(failure ? { partial: true, failure } : {}),
      };
    }
    const first = result.scenarios[scenario.subs[0]];
    if (ctx.notes.length) first.notes = ctx.notes;
    if (ctx.zoomedBox) first.zoomedTableBox = ctx.zoomedBox;
    first.pageErrors = opened.pageErrors.slice(0, 5);
  };
  const isIdle = scenario.key === 'idle';
  const measuredIterations = isIdle ? Math.min(options.iterations, 5) : options.iterations;
  const warmup = isIdle ? 0 : options.warmup;
  const profilePass = Boolean(options.profile) && !isIdle;
  const totalRuns = warmup + measuredIterations + (isIdle ? 0 : 1) + (profilePass ? 1 : 0); // 렌더 카운트 패스 1회 (+ --profile이면 CPU 프로파일 패스 1회)
  for (let i = 0; i < totalRuns; i += 1) {
    const isWarmup = i < warmup;
    const isRenderPass = !isIdle && i === warmup + measuredIterations;
    const isProfilePass = profilePass && i === warmup + measuredIterations + 1;
    const measure = async (sub, types, primary, fn, opts = {}) => {
      ctx.phase = `iter ${i}${isRenderPass ? ' (render pass)' : isWarmup ? ' (warmup)' : ''}: measure ${sub}`;
      const out = await measureWindow(ctx, types, primary, fn, { ...opts, renderPass: isRenderPass, profile: isProfilePass, settleMaxMs: options.settleMaxMs });
      if (isWarmup) return;
      if (isProfilePass) bySub[sub].profile = out.profile;
      else if (isRenderPass) bySub[sub].renderCounts = out;
      else {
        bySub[sub].samples.push({ iteration: i - warmup, metrics: out.metrics });
        bySub[sub].extra.push(out.extra);
      }
    };
    await scenario.run(ctx, i, measure);
    if (options.alignAutosave && !isIdle) {
      ctx.phase = `iter ${i}: wait autosave tick`;
      await page.evaluate((ms) => window.__B.nextSave(ms), AUTOSAVE_WAIT_MS);
    }
  }
  holder.finalize();
}

/**
 * 한 시드 크기에서 전체 시나리오를 실행한다.
 *
 * @param browser  Playwright Browser
 * @param baseUrl  서버 URL
 * @param name     시나리오 이름 (S200 ...)
 * @param options  `{ iterations, warmup, only, alignAutosave }`
 * @returns 크기별 결과
 */
async function runSize(browser, baseUrl, name, options) {
  const size = parseScenarioSize(name);
  const seed = buildErdLocalSeed(size);
  const result = { seed: seed.meta, scenarios: {}, errors: [] };
  options.registerResult?.(name, result);
  const log = (message) => process.stderr.write(`[${name}] ${message}\n`);

  // 크기별 1회: 로드 + H8 + 마이크로 벤치
  {
    log(`load (${seed.meta.tables} tables / ${seed.meta.edges} edges)`);
    const opened = await openSeededPage(browser, baseUrl, seed);
    result.load = {
      loadMs: opened.loadMs,
      longTasks: opened.loadLongTasks,
      probeReady: opened.probeReady,
      pageErrors: opened.pageErrors.slice(0, 5),
    };
    result.h8 = await measureViewportCulling(opened.page);
    result.micro = await measureMicro(opened.page);
    await opened.context.close();
  }

  for (const scenario of SCENARIOS) {
    if (options.only && !options.only.has(scenario.key)) continue;
    log(`scenario ${scenario.key}`);
    const holder = { opened: null, ctx: { phase: 'open page' } };
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`scenario timeout after ${options.scenarioTimeoutS}s at phase "${holder.ctx.phase}"`)),
          options.scenarioTimeoutS * 1000,
        );
      });
      await Promise.race([runScenario(browser, baseUrl, seed, scenario, options, result, holder), timeout]);
    } catch (error) {
      const message = String(error?.message ?? error).split('\n')[0].slice(0, 300);
      log(`scenario ${scenario.key} FAILED: ${message}`);
      result.errors.push({ scenario: scenario.key, message });
      if (holder.finalize) holder.finalize(message);
      else for (const sub of scenario.subs) result.scenarios[sub] ??= { label: scenario.label, iterations: 0, summary: {}, error: message };
    } finally {
      clearTimeout(timer);
      await Promise.race([holder.opened?.context.close().catch(() => {}), new Promise((resolvePromise) => setTimeout(resolvePromise, 15_000))]);
    }
    await options.onProgress?.();
  }
  return result;
}

/**
 * 요약 표(주요 지표)를 stdout용 문자열로 만든다.
 *
 * @param results 크기 → 결과
 * @returns 마크다운 표 문자열
 */
function renderSummaryTable(results) {
  const lines = ['| 시나리오 | 크기 | n | 입력→프레임 p50/p95 (ms) | settle p50/p95 (ms) | longtask 수 p50 | longtask 합 p50/p95 (ms) | 최대 longtask p95 (ms) | task p50 (ms) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [size, result] of Object.entries(results)) {
    for (const [sub, data] of Object.entries(result.scenarios)) {
      const s = data.summary ?? {};
      const pair = (m) => (s[m] && s[m].n ? `${s[m].p50} / ${s[m].p95}` : '-');
      lines.push(
        `| ${sub} | ${size} | ${data.iterations} | ${pair('inputToFrameMs')} | ${pair('settleMs')} | ${s.longTaskCount?.p50 ?? '-'} | ${pair('longTaskTotalMs')} | ${s.longTaskMaxMs?.p95 ?? '-'} | ${s.taskMs?.p50 ?? '-'} |`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * 메인 진입점.
 */
async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write('See the header comment of scripts/perf/erd-app-bench.mjs for usage.\n');
    return;
  }
  const names = (parsed.scenarios ?? 'S200').split(',').map((value) => value.trim()).filter(Boolean);
  for (const name of names) parseScenarioSize(name);
  const options = {
    iterations: Number(parsed.iterations ?? 10),
    warmup: Number(parsed.warmup ?? 2),
    only: parsed.only ? new Set(parsed.only.split(',').map((value) => value.trim())) : null,
    alignAutosave: !parsed['no-align-autosave'],
    scenarioTimeoutS: Number(parsed['scenario-timeout-s'] ?? 420),
    settleMaxMs: Number(parsed['settle-max-s'] ?? 12) * 1000,
    profile: Boolean(parsed.profile),
    onProgress: null,
  };
  if (!Number.isInteger(options.iterations) || options.iterations < 1) throw new Error('--iterations must be a positive integer');
  if (!Number.isInteger(options.warmup) || options.warmup < 0) throw new Error('--warmup must be a non-negative integer');
  const outPath = resolve(clientDir, parsed.out ?? './perf-reports/erd-app-baseline.json');

  const logDir = await mkdtemp(join(os.tmpdir(), 'erd-app-bench-'));
  let vite = null;
  let browser = null;
  try {
    let baseUrl = parsed['base-url'];
    if (!baseUrl) {
      let port = Number(parsed.port ?? 4501);
      while (await isPortBusy(port)) port += port === 4501 ? 10 : 1; // 기존 프로세스는 건드리지 않고 다른 포트 사용
      vite = startVite(port, logDir);
      baseUrl = `http://localhost:${port}`;
      process.stderr.write(`vite starting on ${baseUrl} (log: ${join(logDir, 'vite.log')}, capped ${VITE_LOG_MAX_BYTES} bytes)\n`);
      await waitForServer(new URL('/erd-local', baseUrl).href, vite);
    }
    const executablePath = resolveChromiumPath(parsed['chromium-path']);
    browser = await chromium.launch({ headless: !parsed.headed, executablePath });
    const browserVersion = browser.version();
    // dev 서버 첫 접근 시 의존성 최적화/모듈 변환 비용이 크므로 작은 시드로 한 번 예열한다 (결과 폐기).
    process.stderr.write('prewarm...\n');
    const warm = await openSeededPage(browser, baseUrl, buildErdLocalSeed(20));
    await warm.context.close();

    const results = {};
    const buildOutput = (partial) => ({
      meta: {
        generatedAt: new Date().toISOString(),
        partial,
        node: process.version,
        platform: `${os.platform()} ${os.arch()}`,
        browser: `${browserVersion}${executablePath ? ' (cached chromium via executablePath)' : ''}`,
        viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
        route: '/erd-local',
        server: 'vite dev (frontend-local mode, React development build, StrictMode)',
        iterations: options.iterations,
        warmup: options.warmup,
        alignAutosave: options.alignAutosave,
        settle: { minMs: SETTLE_MIN_MS, quietMs: SETTLE_QUIET_MS, maxMs: options.settleMaxMs },
        idleWindowMs: IDLE_WINDOW_MS,
        scenarioTimeoutS: options.scenarioTimeoutS,
      },
      results,
    });
    await mkdir(dirname(outPath), { recursive: true });
    // 시나리오마다 부분 결과를 저장해, 도중에 중단돼도 지금까지의 데이터가 남도록 한다.
    options.registerResult = (name, result) => {
      results[name] = result;
    };
    options.onProgress = () => writeFile(outPath, `${JSON.stringify(buildOutput(true), null, 2)}\n`);
    for (const name of names) await runSize(browser, baseUrl, name, options);
    await writeFile(outPath, `${JSON.stringify(buildOutput(false), null, 2)}\n`);
    process.stdout.write(`${renderSummaryTable(results)}\n\nwrote ${outPath}\n`);
    const failures = Object.values(results).flatMap((result) => result.errors);
    if (failures.length) process.stdout.write(`scenario failures: ${JSON.stringify(failures)}\n`);
  } finally {
    await browser?.close().catch(() => {});
    await stopVite(vite);
    await rm(logDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
