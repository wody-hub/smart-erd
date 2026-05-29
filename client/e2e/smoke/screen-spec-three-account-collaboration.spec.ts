import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { getE2EProvisioningConfig, type DiagramTarget } from '../shared/diagram-e2e';
import {
  createMaster,
  deleteMaster,
  dragMasterToCanvas,
  expectCollaborationStatus,
  expectInstanceCountVisible,
  expectScreenNameVisible,
  expectSelectedInstanceOrphaned,
  expectSelectedInstanceSize,
  getSelectedInstancePositionText,
  moveSelectedInstanceByKeyboard,
  openScreenSpecDocumentSession,
  renameSelectedScreen,
  resizeSelectedInstance,
  saveScreenSpecDocument,
  selectFirstInstance,
  selectScreenByName,
  updateMasterColor,
  updateMasterLabel,
  waitForScreenSpecEditorReady,
} from '../shared/screen-spec-e2e';

const PROPAGATION_TIMEOUT_MS = 20_000;

interface SignupResponse {
  accessToken: string;
}

interface TeamSummary {
  id: number;
  name: string;
}

interface ProjectSummary {
  id: number;
  name: string;
}

interface DocumentSummary {
  id: number;
  name: string;
}

interface BootstrapSummary {
  engineId: string;
  pluginId: string;
}

interface ProvisionedUser {
  accessToken: string;
  loginId: string;
  password: string;
}

interface BrowserDiagnostics {
  label: string;
  issues: string[];
  websocket: {
    closed: number;
    errors: string[];
    opened: number;
    received: Record<string, number>;
    receivedBytes: Record<string, number>;
    sent: Record<string, number>;
    sentBytes: Record<string, number>;
  };
}

interface DiagnosticPage {
  label: string;
  page: Page;
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  url: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const response =
    method === 'GET'
      ? await request.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ko',
          },
        })
      : await request.post(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ko',
            'Content-Type': 'application/json',
          },
          data: body,
        });

  if (!response.ok()) {
    throw new Error(`Request failed ${response.status()} for ${url}`);
  }

  if (response.status() === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function signupUser(
  request: APIRequestContext,
  apiBaseUrl: string,
  suffix: string,
  label: string,
): Promise<ProvisionedUser> {
  const loginId = `e2e-ss-${label}-${suffix}@example.com`;
  const password = `E2E-${label}-${suffix}`;
  const signup = await request.post(`${apiBaseUrl}/auth/signup`, {
    headers: {
      'Accept-Language': 'ko',
      'Content-Type': 'application/json',
    },
    data: {
      loginId,
      password,
      name: `Screen Spec ${label} ${suffix}`,
    },
  });

  if (!signup.ok()) {
    throw new Error(`Signup failed ${signup.status()} for ${loginId}: ${await signup.text()}`);
  }

  const json = (await signup.json()) as SignupResponse;
  return {
    accessToken: json.accessToken,
    loginId,
    password,
  };
}

async function inviteMemberToTeam(
  request: APIRequestContext,
  apiBaseUrl: string,
  ownerToken: string,
  teamId: number,
  loginId: string,
): Promise<void> {
  await apiJson<void>(request, 'POST', `${apiBaseUrl}/teams/${teamId}/members`, ownerToken, {
    loginId,
    role: 'MEMBER',
  });
}

async function provisionScreenSpecFixture(
  request: APIRequestContext,
  apiBaseUrl: string,
  suffix: string,
): Promise<{ owner: ProvisionedUser; target: DiagramTarget }> {
  const owner = await signupUser(request, apiBaseUrl, suffix, 'owner');
  const team = await apiJson<TeamSummary>(
    request,
    'POST',
    `${apiBaseUrl}/teams`,
    owner.accessToken,
    {
      name: `Screen Spec Team ${suffix}`,
    },
  );
  const project = await apiJson<ProjectSummary>(
    request,
    'POST',
    `${apiBaseUrl}/teams/${team.id}/projects`,
    owner.accessToken,
    { name: `Screen Spec Project ${suffix}` },
  );
  const document = await apiJson<DocumentSummary>(
    request,
    'POST',
    `${apiBaseUrl}/teams/${team.id}/projects/${project.id}/diagrams`,
    owner.accessToken,
    {
      name: `Screen Spec Collab ${suffix}`,
      pluginId: 'screen-spec',
      templateKey: null,
    },
  );

  return {
    owner,
    target: {
      teamId: team.id,
      teamName: team.name,
      projectId: project.id,
      projectName: project.name,
      diagramId: document.id,
      diagramName: document.name,
    },
  };
}

async function assertDocumentAccess(
  request: APIRequestContext,
  apiBaseUrl: string,
  token: string,
  target: DiagramTarget,
): Promise<void> {
  const detail = await apiJson<{ id: number; pluginId: string }>(
    request,
    'GET',
    `${apiBaseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`,
    token,
  );
  const bootstrap = await apiJson<BootstrapSummary>(
    request,
    'GET',
    `${apiBaseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}/bootstrap`,
    token,
  );

  expect(detail.id).toBe(target.diagramId);
  expect(detail.pluginId).toBe('screen-spec');
  expect(bootstrap.pluginId).toBe('screen-spec');
  expect(bootstrap.engineId).toBe('yjs');
}

function attachDiagnostics(context: BrowserContext, label: string): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    label,
    issues: [],
    websocket: {
      closed: 0,
      errors: [],
      opened: 0,
      received: {},
      receivedBytes: {},
      sent: {},
      sentBytes: {},
    },
  };
  context.on('page', (page) => {
    attachPageDiagnostics(page, diagnostics);
  });
  return diagnostics;
}

function attachPageDiagnostics(page: Page, diagnostics: BrowserDiagnostics): void {
  const { label } = diagnostics;
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) {
      return;
    }
    const text = message.text();
    // Chromium can emit this ResizeObserver warning while Konva measures the canvas.
    if (text.includes('ResizeObserver loop completed with undelivered notifications')) {
      return;
    }
    // Yjs emits this once while screen-spec bootstraps preliminary nested types before
    // transaction commit; this scenario verifies the resulting live document state.
    if (text === 'Invalid access: Add Yjs type to a document before reading data.') {
      return;
    }
    // React dev StrictMode can abort a one-time-ticket collaboration socket while the
    // replacement socket connects; the scenario separately proves Canvas live and propagation.
    if (isTransientCollaborationSocket403(text)) {
      return;
    }
    const entry = `[browser:${label}:${message.type()}] ${text}`;
    diagnostics.issues.push(entry);
    console.log(entry);
  });
  page.on('pageerror', (error) => {
    const entry = `[browser:${label}:pageerror] ${error.message}`;
    diagnostics.issues.push(entry);
    console.log(entry);
  });
  page.on('websocket', (webSocket) => {
    diagnostics.websocket.opened += 1;
    webSocket.on('framesent', ({ payload }) => {
      incrementWebSocketFrame(diagnostics.websocket.sent, diagnostics.websocket.sentBytes, payload);
    });
    webSocket.on('framereceived', ({ payload }) => {
      incrementWebSocketFrame(
        diagnostics.websocket.received,
        diagnostics.websocket.receivedBytes,
        payload,
      );
    });
    webSocket.on('socketerror', (message) => {
      // React dev StrictMode can abort a one-time-ticket collaboration socket while the
      // replacement socket connects; the scenario separately proves Canvas live and propagation.
      if (isTransientCollaborationSocket403(message)) {
        return;
      }
      const entry = `[browser:${label}:websocket] ${message}`;
      diagnostics.websocket.errors.push(entry);
      diagnostics.issues.push(entry);
      console.log(entry);
    });
    webSocket.on('close', () => {
      diagnostics.websocket.closed += 1;
    });
  });
}

function isTransientCollaborationSocket403(message: string): boolean {
  return (
    message.includes('Unexpected response code: 403') &&
    (message.includes('/ws/diagram/') || message.includes('WebSocket handshake'))
  );
}

function assertNoBrowserIssues(...diagnostics: BrowserDiagnostics[]): void {
  const issues = diagnostics.flatMap((entry) => entry.issues);
  if (issues.length > 0) {
    throw new Error(`Unexpected browser issues:\n${issues.join('\n')}`);
  }
}

function resetWebSocketFrames(...diagnostics: BrowserDiagnostics[]): void {
  for (const diagnostic of diagnostics) {
    diagnostic.websocket.received = {};
    diagnostic.websocket.receivedBytes = {};
    diagnostic.websocket.sent = {};
    diagnostic.websocket.sentBytes = {};
  }
}

function incrementWebSocketFrame(
  frames: Record<string, number>,
  bytes: Record<string, number>,
  payload: string | Buffer,
): void {
  const typeCode = Buffer.isBuffer(payload) ? payload[0] : payload.charCodeAt(0);
  const key = formatWebSocketFrameType(typeCode);
  frames[key] = (frames[key] ?? 0) + 1;
  bytes[key] = (bytes[key] ?? 0) + payload.length;
}

function formatWebSocketFrameType(typeCode: number | undefined): string {
  switch (typeCode) {
    case 0x01:
      return 'sync-step1';
    case 0x02:
      return 'sync-step2';
    case 0x03:
      return 'yjs-update';
    case 0x04:
      return 'awareness';
    case 0x05:
      return 'snapshot-request';
    case 0x06:
      return 'snapshot-response';
    case 0x08:
      return 'compacted-snapshot';
    case 0x09:
      return 'presence-snapshot';
    case 0x0a:
      return 'peer-joined';
    case 0x0b:
      return 'peer-left';
    case 0x0c:
      return 'presence-snapshot-request';
    case 0x0d:
      return 'snapshot-request-v2';
    case 0x0e:
      return 'snapshot-response-v2';
    default:
      return `unknown-${typeCode ?? 'empty'}`;
  }
}

async function logCollaborationDiagnostics(
  stage: string,
  diagnostics: BrowserDiagnostics[],
  pages: DiagnosticPage[],
): Promise<void> {
  const screenCards = await Promise.all(
    pages.map(async ({ label, page }) => ({
      label,
      screens: await page.getByTestId(/^screen-spec-screen-card-/).allTextContents(),
      status: await page.getByTestId('screen-spec-collaboration-status').textContent(),
    })),
  );
  console.log(
    `[screen-spec-collab:${stage}] ${JSON.stringify({
      screens: screenCards,
      websocket: diagnostics.map((entry) => ({
        label: entry.label,
        opened: entry.websocket.opened,
        closed: entry.websocket.closed,
        sent: entry.websocket.sent,
        sentBytes: entry.websocket.sentBytes,
        received: entry.websocket.received,
        receivedBytes: entry.websocket.receivedBytes,
        errors: entry.websocket.errors,
      })),
    })}`,
  );
}

test('three accounts collaborate on screen-spec master lifecycle, propagation, and lock UX @smoke', async ({
  browser,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fixture = await provisionScreenSpecFixture(request, config.apiBaseUrl, suffix);

  const memberOne = await signupUser(request, config.apiBaseUrl, suffix, 'member-one');
  const memberTwo = await signupUser(request, config.apiBaseUrl, suffix, 'member-two');
  await inviteMemberToTeam(
    request,
    config.apiBaseUrl,
    fixture.owner.accessToken,
    fixture.target.teamId,
    memberOne.loginId,
  );
  await inviteMemberToTeam(
    request,
    config.apiBaseUrl,
    fixture.owner.accessToken,
    fixture.target.teamId,
    memberTwo.loginId,
  );
  await assertDocumentAccess(request, config.apiBaseUrl, memberOne.accessToken, fixture.target);
  await assertDocumentAccess(request, config.apiBaseUrl, memberTwo.accessToken, fixture.target);

  const ownerContext = await browser.newContext();
  const memberOneContext = await browser.newContext();
  const memberTwoContext = await browser.newContext();

  try {
    const ownerDiagnostics = attachDiagnostics(ownerContext, 'owner');
    const memberOneDiagnostics = attachDiagnostics(memberOneContext, 'member-one');
    const memberTwoDiagnostics = attachDiagnostics(memberTwoContext, 'member-two');

    const ownerPage = await openScreenSpecDocumentSession(
      ownerContext,
      config,
      fixture.owner.loginId,
      fixture.owner.password,
      fixture.target,
    );
    await saveScreenSpecDocument(ownerPage);
    const memberOnePage = await openScreenSpecDocumentSession(
      memberOneContext,
      config,
      memberOne.loginId,
      memberOne.password,
      fixture.target,
    );
    const memberTwoPage = await openScreenSpecDocumentSession(
      memberTwoContext,
      config,
      memberTwo.loginId,
      memberTwo.password,
      fixture.target,
    );

    const screenA = `Owner screen A ${suffix}`;
    const screenB = `Owner screen B ${suffix}`;
    const lockScreenName = `Owner screen A lock ${suffix}`;
    const memberOneScreen = `Member one screen ${suffix}`;
    const masterName = `Shared CTA ${suffix}`;
    const updatedMasterName = `Shared CTA Updated ${suffix}`;
    const rejectedScreenName = `Member two conflict ${suffix}`;
    const inheritedColor = '#2563eb';

    resetWebSocketFrames(ownerDiagnostics, memberOneDiagnostics, memberTwoDiagnostics);
    await renameSelectedScreen(ownerPage, screenA);
    await addAndRenameSecondScreen(ownerPage, screenB);
    try {
      await expectScreensVisible([memberOnePage, memberTwoPage], screenA, screenB);
    } catch (error) {
      await logCollaborationDiagnostics(
        'initial-screen-propagation',
        [ownerDiagnostics, memberOneDiagnostics, memberTwoDiagnostics],
        [
          { label: 'owner', page: ownerPage },
          { label: 'member-one', page: memberOnePage },
          { label: 'member-two', page: memberTwoPage },
        ],
      );
      throw error;
    }

    await createMaster(ownerPage, masterName);
    await expectMasterVisible([memberOnePage, memberTwoPage], masterName);
    await selectScreenByName(ownerPage, screenA);
    await dragMasterToCanvas(ownerPage, masterName);
    await selectScreenByName(ownerPage, screenB);
    await dragMasterToCanvas(ownerPage, masterName);

    await expectInstancesOnScreens([memberOnePage, memberTwoPage], [screenA, screenB], 1);
    await updateMasterLabel(ownerPage, masterName, updatedMasterName);
    await updateMasterColor(ownerPage, updatedMasterName, inheritedColor);
    await assertInheritedInstanceState(memberOnePage, screenA, updatedMasterName, inheritedColor);
    await assertInheritedInstanceState(memberOnePage, screenB, updatedMasterName, inheritedColor);
    await assertInheritedInstanceState(memberTwoPage, screenA, updatedMasterName, inheritedColor);
    await assertInheritedInstanceState(memberTwoPage, screenB, updatedMasterName, inheritedColor);

    await expectCollaborationStatus(memberTwoPage, /캔버스 연결됨|canvas live/i, 10_000);
    await selectScreenByName(ownerPage, screenA);
    await selectFirstInstance(ownerPage);
    const ownerBeforeMove = await getSelectedInstancePositionText(ownerPage);
    await selectScreenByName(memberTwoPage, screenA);
    await selectFirstInstance(memberTwoPage);
    await moveSelectedInstanceByKeyboard(memberTwoPage, 3, 2);
    await expect
      .poll(() => getSelectedInstancePositionText(ownerPage), { timeout: PROPAGATION_TIMEOUT_MS })
      .not.toBe(ownerBeforeMove);

    await resizeSelectedInstance(memberTwoPage, 180, 64);
    await expectSelectedInstanceSize(memberTwoPage, 180, 64);
    await selectScreenByName(memberOnePage, screenA);
    await selectFirstInstance(memberOnePage);
    await expectSelectedInstanceSize(memberOnePage, 180, 64);

    await addAndRenameSecondScreen(memberOnePage, memberOneScreen);
    await expectScreenNameVisible(ownerPage, memberOneScreen);
    await expectScreenNameVisible(memberTwoPage, memberOneScreen);

    await selectScreenByName(ownerPage, screenA);
    await renameSelectedScreen(ownerPage, lockScreenName);
    await expectScreenNameVisible(memberTwoPage, lockScreenName);
    await expectCollaborationStatus(memberTwoPage, /같은 범위|editing this scope|잠금|locked/i);
    await selectScreenByName(memberTwoPage, lockScreenName);
    await attemptRenameSelectedScreen(memberTwoPage, rejectedScreenName);
    await expectCollaborationStatus(memberTwoPage, /거절|rejected|충돌|conflict/i);
    await expect(ownerPage.getByText(rejectedScreenName, { exact: true })).toHaveCount(0);
    await expect(memberOnePage.getByText(rejectedScreenName, { exact: true })).toHaveCount(0);

    await deleteMaster(ownerPage, updatedMasterName);
    await assertOrphanOnScreens(
      [ownerPage, memberOnePage, memberTwoPage],
      [lockScreenName, screenB],
    );

    await saveScreenSpecDocument(ownerPage);
    await ownerPage.reload({ waitUntil: 'domcontentloaded' });
    await memberOnePage.reload({ waitUntil: 'domcontentloaded' });
    await memberTwoPage.reload({ waitUntil: 'domcontentloaded' });
    await Promise.all([
      waitForScreenSpecEditorReady(ownerPage),
      waitForScreenSpecEditorReady(memberOnePage),
      waitForScreenSpecEditorReady(memberTwoPage),
    ]);
    await expectScreensVisible([ownerPage, memberOnePage, memberTwoPage], lockScreenName, screenB);
    await expectScreensVisible([ownerPage, memberOnePage, memberTwoPage], memberOneScreen);
    await assertOrphanOnScreens(
      [ownerPage, memberOnePage, memberTwoPage],
      [lockScreenName, screenB],
    );

    assertNoBrowserIssues(ownerDiagnostics, memberOneDiagnostics, memberTwoDiagnostics);
    test.info().annotations.push(
      { type: 'target-team', description: `${fixture.target.teamId}:${fixture.target.teamName}` },
      {
        type: 'target-project',
        description: `${fixture.target.projectId}:${fixture.target.projectName}`,
      },
      {
        type: 'target-diagram',
        description: `${fixture.target.diagramId}:${fixture.target.diagramName}`,
      },
      { type: 'screen-spec-master', description: masterName },
    );
  } finally {
    await ownerContext.close();
    await memberOneContext.close();
    await memberTwoContext.close();
  }
});

async function addAndRenameSecondScreen(page: Page, name: string): Promise<void> {
  await page
    .getByRole('button', { name: /추가|add/i })
    .first()
    .click();
  await renameSelectedScreen(page, name);
}

async function attemptRenameSelectedScreen(page: Page, name: string): Promise<void> {
  const input = page.getByTestId('screen-spec-screen-name-input');
  await expect(input).toBeVisible();
  await input.fill(name);
  await input.press('Enter');
}

async function expectScreensVisible(pages: Page[], ...screenNames: string[]): Promise<void> {
  for (const page of pages) {
    for (const screenName of screenNames) {
      await expectScreenNameVisible(page, screenName);
    }
  }
}

async function expectMasterVisible(pages: Page[], masterName: string): Promise<void> {
  for (const page of pages) {
    await expect(
      page.getByTestId(/^screen-spec-master-card-/).filter({ hasText: masterName }),
    ).toBeVisible({
      timeout: PROPAGATION_TIMEOUT_MS,
    });
  }
}

async function expectInstancesOnScreens(
  pages: Page[],
  screenNames: string[],
  count: number,
): Promise<void> {
  for (const page of pages) {
    for (const screenName of screenNames) {
      await selectScreenByName(page, screenName);
      await expectInstanceCountVisible(page, count);
    }
  }
}

async function assertInheritedInstanceState(
  page: Page,
  screenName: string,
  masterLabel: string,
  expectedColor: string,
): Promise<void> {
  await selectScreenByName(page, screenName);
  await selectFirstInstance(page);
  await expect(page.getByText(masterLabel, { exact: true }).first()).toBeVisible({
    timeout: PROPAGATION_TIMEOUT_MS,
  });
  await expect(page.locator('#screen-spec-instance-accent')).toHaveValue(expectedColor);
  await expect(
    page.getByText(/마스터 기본값을 그대로 사용 중입니다|inherited from the master/i).first(),
  ).toBeVisible();
}

async function assertOrphanOnScreens(pages: Page[], screenNames: string[]): Promise<void> {
  for (const page of pages) {
    for (const screenName of screenNames) {
      await selectScreenByName(page, screenName);
      await selectFirstInstance(page);
      await expectSelectedInstanceOrphaned(page);
    }
  }
}
