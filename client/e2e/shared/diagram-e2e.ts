import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';
import { expect, type Locator, type Page } from '@playwright/test';

interface DiagramSummary {
  id: number;
  name: string;
}

interface ProjectSummary {
  id: number;
  name: string;
}

interface TeamSummary {
  id: number;
  name: string;
}

interface DiagramDetail {
  content: string | null;
}

interface DictionarySetSummary {
  id: number;
  name: string;
  isDefault: boolean;
}

export interface DiagramTarget {
  teamId: number;
  teamName: string;
  projectId: number;
  projectName: string;
  diagramId: number;
  diagramName: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface E2EConfig {
  baseUrl: string;
  apiBaseUrl: string;
  frontendHost: string;
  backendHost: string;
  loginId: string;
  password: string;
  pinnedTeamId: number | null;
  pinnedProjectId: number | null;
  pinnedDiagramId: number | null;
  backendPort: number;
  frontendPort: number;
  backendRestartCommand: string;
  repoDir: string;
  bootLogPath: string;
}

interface ProvisionCollaborationFixtureOptions {
  pluginId?: 'erd' | 'markdown' | 'screen-spec';
  diagramName?: string;
  templateKey?: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRequiredUrl(url: string, envName: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new Error(`Invalid URL in ${envName}: ${url}`);
  }
}

function resolveEndpointConfig(
  url: string,
  urlEnvName: string,
  portEnvName: string,
  portEnvValue: string | undefined,
  fallbackPort: number,
): { url: string; host: string; port: number } {
  const parsedUrl = parseRequiredUrl(url, urlEnvName);
  const explicitUrlPort = parsedUrl.port ? parsePositiveInt(parsedUrl.port, fallbackPort) : null;
  const configuredPort = portEnvValue ? parsePositiveInt(portEnvValue, fallbackPort) : explicitUrlPort ?? fallbackPort;
  if (explicitUrlPort !== null && configuredPort !== explicitUrlPort) {
    throw new Error(
      `Conflicting E2E endpoint configuration: ${urlEnvName}=${url} but ${portEnvName}=${configuredPort}`,
    );
  }
  parsedUrl.port = String(configuredPort);

  return {
    url: parsedUrl.toString().replace(/\/$/, ''),
    host: parsedUrl.hostname,
    port: configuredPort,
  };
}

function assertLocalHost(host: string, label: string): void {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return;
  }
  throw new Error(`${label} only supports local hosts, but received ${host}`);
}

function parseTranslate(transform: string): Point {
  const matched = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
  if (!matched) {
    throw new Error(`Unable to parse transform: ${transform}`);
  }
  return {
    x: Number(matched[1]),
    y: Number(matched[2]),
  };
}

function parseScale(transform: string): number {
  if (!transform || transform === 'none') {
    return 1;
  }
  const matched = /matrix\(([^)]+)\)/.exec(transform);
  if (!matched) {
    return 1;
  }
  const values = matched[1].split(',').map((value) => Number(value.trim()));
  return Number.isFinite(values[0]) && values[0] > 0 ? values[0] : 1;
}

function resolveDefaultBackendRestartCommand(port: number): string {
  if (port === 9501) {
    return './bootRun-local.sh';
  }
  if (port === 9502) {
    return './bootRun-test.sh';
  }
  return port === 9503 ? './bootRun-dev.sh' : `SERVER_PORT=${port} ./gradlew bootRun`;
}

async function waitForPortState(
  port: number,
  open: boolean,
  timeoutMs: number,
  host = '127.0.0.1',
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (connected === open) {
      return;
    }
    await delay(250);
  }

  const state = open ? 'open' : 'closed';
  throw new Error(`Port ${port} did not become ${state} within ${timeoutMs}ms`);
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'ko',
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'ko',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

function parseRenderableNodeCount(content: string | null | undefined): number {
  if (!content) {
    return 0;
  }
  try {
    const parsed = JSON.parse(content) as { nodes?: unknown[] };
    return Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
  } catch {
    return 0;
  }
}

function isListeningOnPort(port: number): boolean {
  try {
    const pid = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t | head -n1`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return pid.length > 0;
  } catch {
    return false;
  }
}

export function resolveDefaultE2EEndpoints(
  isPortOpen: (port: number) => boolean = isListeningOnPort,
): { baseUrl: string; apiBaseUrl: string } {
  const profiles = [
    { frontendPort: 4501, backendPort: 9501 },
    { frontendPort: 4502, backendPort: 9502 },
    { frontendPort: 4503, backendPort: 9503 },
  ];

  for (const profile of profiles) {
    if (isPortOpen(profile.frontendPort) && isPortOpen(profile.backendPort)) {
      return {
        baseUrl: `http://localhost:${profile.frontendPort}`,
        apiBaseUrl: `http://localhost:${profile.backendPort}/api`,
      };
    }
  }

  return {
    baseUrl: 'http://localhost:4502',
    apiBaseUrl: 'http://localhost:9502/api',
  };
}

export function getE2EConfig(): E2EConfig {
  const defaults = resolveDefaultE2EEndpoints();
  const baseUrl = process.env.SMART_ERD_E2E_BASE_URL ?? defaults.baseUrl;
  const apiBaseUrl = process.env.SMART_ERD_E2E_API_URL ?? defaults.apiBaseUrl;
  const repoDir = process.env.SMART_ERD_E2E_REPO_DIR ?? path.resolve(process.cwd(), '..');
  const frontendEndpoint = resolveEndpointConfig(
    baseUrl,
    'SMART_ERD_E2E_BASE_URL',
    'SMART_ERD_E2E_FRONTEND_PORT',
    process.env.SMART_ERD_E2E_FRONTEND_PORT,
    4502,
  );
  const backendEndpoint = resolveEndpointConfig(
    apiBaseUrl,
    'SMART_ERD_E2E_API_URL',
    'SMART_ERD_E2E_BACKEND_PORT',
    process.env.SMART_ERD_E2E_BACKEND_PORT,
    9502,
  );

  return {
    baseUrl: frontendEndpoint.url,
    apiBaseUrl: backendEndpoint.url,
    frontendHost: frontendEndpoint.host,
    backendHost: backendEndpoint.host,
    loginId: requireEnv('SMART_ERD_E2E_LOGIN'),
    password: requireEnv('SMART_ERD_E2E_PASSWORD'),
    pinnedTeamId: parseOptionalPositiveInt(process.env.SMART_ERD_E2E_TEAM_ID),
    pinnedProjectId: parseOptionalPositiveInt(process.env.SMART_ERD_E2E_PROJECT_ID),
    pinnedDiagramId: parseOptionalPositiveInt(process.env.SMART_ERD_E2E_DIAGRAM_ID),
    backendPort: backendEndpoint.port,
    frontendPort: frontendEndpoint.port,
    backendRestartCommand:
      process.env.SMART_ERD_E2E_BACKEND_RESTART_CMD ??
      resolveDefaultBackendRestartCommand(backendEndpoint.port),
    repoDir,
    bootLogPath:
      process.env.SMART_ERD_E2E_BOOT_LOG_PATH ?? '/tmp/smart-erd-e2e-recovery-backend.log',
  };
}

export function getE2EProvisioningConfig(): E2EConfig {
  const defaults = resolveDefaultE2EEndpoints();
  const baseUrl = process.env.SMART_ERD_E2E_BASE_URL ?? defaults.baseUrl;
  const apiBaseUrl = process.env.SMART_ERD_E2E_API_URL ?? defaults.apiBaseUrl;
  const repoDir = process.env.SMART_ERD_E2E_REPO_DIR ?? path.resolve(process.cwd(), '..');
  const frontendEndpoint = resolveEndpointConfig(
    baseUrl,
    'SMART_ERD_E2E_BASE_URL',
    'SMART_ERD_E2E_FRONTEND_PORT',
    process.env.SMART_ERD_E2E_FRONTEND_PORT,
    4502,
  );
  const backendEndpoint = resolveEndpointConfig(
    apiBaseUrl,
    'SMART_ERD_E2E_API_URL',
    'SMART_ERD_E2E_BACKEND_PORT',
    process.env.SMART_ERD_E2E_BACKEND_PORT,
    9502,
  );

  return {
    baseUrl: frontendEndpoint.url,
    apiBaseUrl: backendEndpoint.url,
    frontendHost: frontendEndpoint.host,
    backendHost: backendEndpoint.host,
    loginId: process.env.SMART_ERD_E2E_LOGIN ?? 'e2e-provision@example.com',
    password: process.env.SMART_ERD_E2E_PASSWORD ?? 'e2e-provision-password',
    pinnedTeamId: parseOptionalPositiveInt(process.env.SMART_ERD_E2E_TEAM_ID),
    pinnedProjectId: parseOptionalPositiveInt(process.env.SMART_ERD_E2E_PROJECT_ID),
    pinnedDiagramId: parseOptionalPositiveInt(process.env.SMART_ERD_E2E_DIAGRAM_ID),
    backendPort: backendEndpoint.port,
    frontendPort: frontendEndpoint.port,
    backendRestartCommand:
      process.env.SMART_ERD_E2E_BACKEND_RESTART_CMD ??
      resolveDefaultBackendRestartCommand(backendEndpoint.port),
    repoDir,
    bootLogPath:
      process.env.SMART_ERD_E2E_BOOT_LOG_PATH ?? '/tmp/smart-erd-e2e-recovery-backend.log',
  };
}

export async function provisionCollaborationFixture(
  config: E2EConfig,
  options: ProvisionCollaborationFixtureOptions = {},
): Promise<{ loginId: string; password: string; target: DiagramTarget }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const loginId = `e2e-collab-${suffix}@example.com`;
  const password = `E2E-${suffix}`;
  const pluginId = options.pluginId ?? 'erd';
  const signup = await postJson<{
    accessToken: string;
  }>(`${config.apiBaseUrl}/auth/signup`, {
    loginId,
    password,
    name: `E2E ${suffix}`,
  });

  const team = await postJson<TeamSummary>(
    `${config.apiBaseUrl}/teams`,
    { name: `E2E Team ${suffix}` },
    signup.accessToken,
  );
  let dictionarySetId: number | null = null;
  if (pluginId === 'erd') {
    const dictionarySets = await fetchJson<DictionarySetSummary[]>(
      `${config.apiBaseUrl}/teams/${team.id}/dictionary-sets`,
      signup.accessToken,
    );
    const dictionarySet =
      dictionarySets.find((candidate) => candidate.isDefault) ??
      dictionarySets[0] ??
      (await postJson<DictionarySetSummary>(
        `${config.apiBaseUrl}/teams/${team.id}/dictionary-sets`,
        { name: `E2E Dictionary ${suffix}` },
        signup.accessToken,
      ));
    dictionarySetId = dictionarySet.id;
  }

  const project = await postJson<ProjectSummary>(
    `${config.apiBaseUrl}/teams/${team.id}/projects`,
    { name: `E2E Project ${suffix}` },
    signup.accessToken,
  );
  const diagram = await postJson<DiagramSummary>(
    `${config.apiBaseUrl}/teams/${team.id}/projects/${project.id}/diagrams`,
    {
      name: options.diagramName ?? `E2E Diagram ${suffix}`,
      pluginId,
      dictionarySetId,
      templateKey: pluginId === 'markdown' ? (options.templateKey ?? null) : null,
    },
    signup.accessToken,
  );

  return {
    loginId,
    password,
    target: {
      teamId: team.id,
      teamName: team.name,
      projectId: project.id,
      projectName: project.name,
      diagramId: diagram.id,
      diagramName: diagram.name,
    },
  };
}

export async function loginViaUi(page: Page, config: E2EConfig): Promise<string> {
  await waitForPortState(config.frontendPort, true, 5_000, config.frontendHost).catch((error) => {
    throw new Error(
      `Frontend server is not ready on ${config.frontendHost}:${config.frontendPort} for ${config.baseUrl}: ${String(error)}`,
    );
  });
  await page.goto(`${config.baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-id', config.loginId);
  await page.fill('#password', config.password);
  await page.getByRole('button', { name: /로그인|login/i }).click();
  await page.waitForURL('**/teams', { timeout: 30_000 });

  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) {
    throw new Error('Access token not found after login');
  }
  return token;
}

export async function openCodeEditor(page: Page, timeoutMs = 15_000): Promise<void> {
  const hasMonacoModel = async (): Promise<boolean> =>
    page.evaluate(() => Boolean(window.monaco?.editor?.getModels?.().length));

  if (await hasMonacoModel()) {
    return;
  }

  const legacyCodeButton = page.getByRole('button', { name: /^(코드|Code)$/ });
  if (await legacyCodeButton.isVisible().catch(() => false)) {
    await legacyCodeButton.click();
  } else {
    const workModeTrigger = page.getByRole('combobox', { name: /작업 모드|Work mode/i });
    await expect(workModeTrigger).toBeVisible({ timeout: timeoutMs });

    const currentWorkMode = (await workModeTrigger.textContent())?.trim() ?? '';
    if (!/코드 위주|Code-first/i.test(currentWorkMode)) {
      await workModeTrigger.click();
      await page.getByRole('option', { name: /코드 위주|Code-first/i }).click();
    }
  }

  await page.waitForFunction(
    () => Boolean(window.monaco?.editor?.getModels?.().length),
    undefined,
    { timeout: timeoutMs },
  );
}

export async function waitForMonacoModelValueContains(
  page: Page,
  fragment: string,
  timeoutMs = 15_000,
): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const model = window.monaco?.editor?.getModels?.()[0];
      return model?.getValue().includes(expected) ?? false;
    },
    fragment,
    { timeout: timeoutMs },
  );
}

export async function resolveTargetDiagram(
  token: string,
  config: E2EConfig,
): Promise<DiagramTarget> {
  const teams = await fetchJson<TeamSummary[]>(`${config.apiBaseUrl}/teams`, token);
  const explicitTarget =
    config.pinnedTeamId !== null &&
    config.pinnedProjectId !== null &&
    config.pinnedDiagramId !== null;

  if (explicitTarget) {
    const team = teams.find((candidate) => candidate.id === config.pinnedTeamId);
    if (!team) {
      throw new Error(`Configured team ${config.pinnedTeamId} was not found for the test account`);
    }

    const projects = await fetchJson<ProjectSummary[]>(
      `${config.apiBaseUrl}/teams/${team.id}/projects`,
      token,
    );
    const project = projects.find((candidate) => candidate.id === config.pinnedProjectId);
    if (!project) {
      throw new Error(
        `Configured project ${config.pinnedProjectId} was not found under team ${team.id}`,
      );
    }

    const diagrams = await fetchJson<DiagramSummary[]>(
      `${config.apiBaseUrl}/teams/${team.id}/projects/${project.id}/diagrams`,
      token,
    );
    const diagram = diagrams.find((candidate) => candidate.id === config.pinnedDiagramId);
    if (!diagram) {
      throw new Error(
        `Configured diagram ${config.pinnedDiagramId} was not found under project ${project.id}`,
      );
    }

    return {
      teamId: team.id,
      teamName: team.name,
      projectId: project.id,
      projectName: project.name,
      diagramId: diagram.id,
      diagramName: diagram.name,
    };
  }

  for (const team of teams) {
    const projects = await fetchJson<ProjectSummary[]>(
      `${config.apiBaseUrl}/teams/${team.id}/projects`,
      token,
    );
    for (const project of projects) {
      const diagrams = await fetchJson<DiagramSummary[]>(
        `${config.apiBaseUrl}/teams/${team.id}/projects/${project.id}/diagrams`,
        token,
      );
      for (const diagram of diagrams) {
        const detail = await fetchJson<DiagramDetail>(
          `${config.apiBaseUrl}/teams/${team.id}/projects/${project.id}/diagrams/${diagram.id}`,
          token,
        );
        if (parseRenderableNodeCount(detail.content) > 0) {
          return {
            teamId: team.id,
            teamName: team.name,
            projectId: project.id,
            projectName: project.name,
            diagramId: diagram.id,
            diagramName: diagram.name,
          };
        }
      }
    }
  }

  throw new Error('No diagram with renderable nodes found for the configured account');
}

export function diagramUrl(config: E2EConfig, target: DiagramTarget): string {
  return `${config.baseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`;
}

export async function waitForDiagramNode(
  page: Page,
  selector = '.react-flow__node-table',
): Promise<Locator> {
  const node = page.locator(selector).first();
  await node.waitFor({ state: 'visible', timeout: 30_000 });
  return node;
}

export async function getNodeModelPosition(locator: Locator): Promise<Point> {
  const transform = await locator.evaluate((element) => {
    let current: HTMLElement | null = element as HTMLElement;
    while (current) {
      if (current.style.transform.includes('translate(')) {
        return current.style.transform;
      }
      current = current.parentElement;
    }
    throw new Error('Node transform not found');
  });
  return parseTranslate(transform);
}

export async function getViewportScale(page: Page): Promise<number> {
  const transform = await page
    .locator('.react-flow__viewport')
    .evaluate((element) => getComputedStyle(element).transform);
  return parseScale(transform);
}

export async function dragNodeByScreenDelta(
  page: Page,
  locator: Locator,
  screenDx: number,
  screenDy: number,
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Node bounding box not found');
  }

  const startX = box.x + Math.min(box.width / 2, 120);
  const startY = box.y + 24;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const maxDelta = Math.max(Math.abs(screenDx), Math.abs(screenDy));
  if (maxDelta > 0 && maxDelta < 24) {
    await page.mouse.move(
      startX + (screenDx === 0 ? 0 : Math.sign(screenDx) * 24),
      startY + (screenDy === 0 ? 0 : Math.sign(screenDy) * 24),
      { steps: 6 },
    );
  }
  await page.mouse.move(startX + screenDx, startY + screenDy, { steps: 12 });
  await page.mouse.up();
  await delay(500);
}

function toScreenDelta(modelDelta: number, scale: number): number {
  if (Math.abs(modelDelta) <= 1) {
    return 0;
  }
  return modelDelta * scale;
}

export async function dragNodeToModelPosition(
  page: Page,
  locator: Locator,
  target: Point,
  tolerance = 5,
  maxAttempts = 4,
): Promise<Point> {
  let current = await getNodeModelPosition(locator);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remainingDx = target.x - current.x;
    const remainingDy = target.y - current.y;

    if (Math.abs(remainingDx) <= tolerance && Math.abs(remainingDy) <= tolerance) {
      return current;
    }

    const viewportScale = await getViewportScale(page);
    await dragNodeByScreenDelta(
      page,
      locator,
      toScreenDelta(remainingDx, viewportScale),
      toScreenDelta(remainingDy, viewportScale),
    );
    current = await getNodeModelPosition(locator);
  }

  return current;
}

export async function waitForEditableDiagram(page: Page, timeoutMs = 30_000): Promise<Locator> {
  const backupButton = page.getByRole('button', { name: /백업|backup/i });
  const retryButton = page.getByRole('button', { name: /재시도|retry/i });
  const deadline = Date.now() + timeoutMs;
  let manualRetryCount = 0;
  let previousRetryVisible = false;

  while (Date.now() < deadline) {
    if (await backupButton.isVisible().catch(() => false)) {
      return backupButton;
    }

    const retryVisible = await retryButton.isVisible().catch(() => false);
    if (retryVisible && !previousRetryVisible && manualRetryCount < 2) {
      await retryButton.click();
      manualRetryCount += 1;
      previousRetryVisible = true;
      await delay(2_000);
      continue;
    }
    previousRetryVisible = retryVisible;

    await delay(1_000);
  }

  throw new Error('Diagram did not become editable within the expected time');
}

export async function clickBackup(page: Page): Promise<void> {
  const backupButton = await waitForEditableDiagram(page, 30_000);
  await backupButton.click();
  await delay(1_000);
}

export async function clickBackupAndWaitForPersistedDiagramSave(
  page: Page,
  target: DiagramTarget,
  timeoutMs = 30_000,
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(
        `/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`,
      ) &&
      response.status() >= 200 &&
      response.status() < 300,
    { timeout: timeoutMs },
  );

  await clickBackup(page);
  await responsePromise;
}

export async function restartBackend(config: E2EConfig): Promise<number> {
  assertLocalHost(config.backendHost, 'restartBackend');
  const pid = execSync(`lsof -nP -iTCP:${config.backendPort} -sTCP:LISTEN -t | head -n1`, {
    encoding: 'utf-8',
  }).trim();
  if (!pid) {
    throw new Error(`No backend listener found on port ${config.backendPort}`);
  }

  process.kill(Number(pid), 'SIGTERM');
  await waitForPortState(config.backendPort, false, 20_000, config.backendHost);

  execSync(`: > ${config.bootLogPath}`, { shell: '/bin/zsh' });
  const child = spawn(
    '/bin/zsh',
    ['-lc', `${config.backendRestartCommand} > ${config.bootLogPath} 2>&1`],
    {
      cwd: config.repoDir,
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();

  await waitForPortState(config.backendPort, true, 120_000, config.backendHost);
  await delay(3_000);
  return child.pid ?? 0;
}

export async function captureDiagramReady(
  page: Page,
  url: string,
  selector?: string,
): Promise<{ node: Locator; visibleMs: number }> {
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const node = await waitForDiagramNode(page, selector);
  return {
    node,
    visibleMs: Date.now() - startedAt,
  };
}

export async function expectDiagramHeaderVisible(page: Page, target: DiagramTarget): Promise<void> {
  await expect(
    page.locator('header').getByText(target.diagramName, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
}
