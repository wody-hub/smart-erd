import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ts from 'typescript';
import { chromium } from 'playwright';

/** 셸을 거치지 않는, 출력/시간 제한이 있는 프로세스 조회. */
const execute = promisify(execFile);

/**
 * 기존 TS E2E 헬퍼를 제품/기존 파일 변경 없이 ESM으로 로드한다.
 * @returns {Promise<object>} 공유 헬퍼 exports
 */
export async function loadDiagramHelpers() {
  const source = await readFile(
    new URL('../../../e2e/shared/diagram-e2e.ts', import.meta.url),
    'utf8',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const code = outputText.replaceAll(
    "'@playwright/test'",
    JSON.stringify(import.meta.resolve('@playwright/test')),
  );
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

/**
 * 기존 앱 벤치의 Chromium 캐시 탐색 패턴을 따른다.
 * @param {string|undefined} explicit 명시 실행 파일
 * @returns {string} 실제 실행 파일 경로
 */
export function resolveChromiumPath(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error('--chromium-path does not exist');
    return explicit;
  }
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(os.homedir(), 'Library/Caches/ms-playwright'),
    join(os.homedir(), '.cache/ms-playwright'),
  ].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of dirs) {
      const candidates = [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-linux/chrome',
        'chrome-linux64/chrome',
      ];
      const found = candidates.map((suffix) => join(root, dir, suffix)).find(existsSync);
      if (found) return found;
    }
  }
  throw new Error('No cached Chromium found; supply --chromium-path');
}

/**
 * 최근접 순위법으로 수열의 백분위수를 계산한다.
 * @param {number[]} values 유한 수열
 * @returns {object} n/p50/p95/max/mean(빈 배열은 null)
 */
export function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0, p50: null, p95: null, max: null, mean: null };
  /** 표시 정밀도는 소수점 세 자리다. */
  const round = (value) => Math.round(value * 1000) / 1000;
  return {
    n: sorted.length,
    p50: round(sorted[Math.ceil(sorted.length * 0.5) - 1]),
    p95: round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    max: round(sorted.at(-1)),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
  };
}

/**
 * 포트 리스너 중 java PID를 검증한다. 서버에 신호를 보내지 않는다.
 * @param {number} port 백엔드 포트
 * @returns {Promise<number>} 검증된 java PID
 */
async function findJavaPid(port) {
  const { stdout } = await execute('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    timeout: 2000,
    maxBuffer: 16384,
  });
  const pids = [...new Set(stdout.trim().split(/\s+/).filter(Boolean))];
  for (const pid of pids) {
    const { stdout: command } = await execute('ps', ['-p', pid, '-o', 'comm='], {
      timeout: 2000,
      maxBuffer: 16384,
    });
    if (/(?:^|\/)java\s*$/.test(command.trim())) return Number(pid);
  }
  throw new Error(`No java listener found on port ${port}`);
}

/**
 * java CPU/RSS를 1초 간격으로 수집한다. ps 외의 프로세스는 시작하지 않는다.
 * @param {number} port 백엔드 포트
 * @returns {Promise<object>} stop()으로 샘플과 집계 반환
 */
export async function startServerSampler(port) {
  const pid = await findJavaPid(port);
  const samples = [];
  const errors = [];
  let pending = null;
  /** 샘플 하나를 수집하며 중복 실행을 피한다. */
  async function sample() {
    try {
      const { stdout } = await execute('ps', ['-p', String(pid), '-o', '%cpu=,rss='], {
        timeout: 2000,
        maxBuffer: 16384,
        env: { ...process.env, LC_ALL: 'C' },
      });
      const [cpuPercent, rssKiB] = stdout.trim().split(/\s+/).map(Number);
      if (!Number.isFinite(cpuPercent) || !Number.isFinite(rssKiB)) {
        throw new Error('ps returned no numeric CPU/RSS sample');
      }
      samples.push({ at: new Date().toISOString(), cpuPercent, rssMiB: rssKiB / 1024 });
    } catch (error) {
      if (errors.length < 10) errors.push(String(error.message).slice(0, 200));
    }
  }
  await sample();
  const timer = setInterval(() => {
    if (pending) return;
    pending = sample().finally(() => {
      pending = null;
    });
  }, 1000);
  return {
    async stop() {
      clearInterval(timer);
      await pending;
      await sample();
      return {
        pid,
        intervalMs: 1000,
        cpuPercent: summarize(samples.map((sample) => sample.cpuPercent)),
        rssMiB: summarize(samples.map((sample) => sample.rssMiB)),
        samples,
        errors,
      };
    },
  };
}

/**
 * 현재 checkout의 커밋을 조회한다.
 * @returns {Promise<string>} 커밋 해시
 */
export async function commitHash() {
  const { stdout } = await execute('git', ['rev-parse', 'HEAD'], {
    timeout: 2000,
    maxBuffer: 16384,
  });
  return stdout.trim();
}
