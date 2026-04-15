import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { getE2EProvisioningConfig, loginViaUi } from '../shared/diagram-e2e';

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
  snapshotAvailable: boolean;
}

interface ProvisionedUser {
  accessToken: string;
  loginId: string;
  password: string;
}

interface MarkdownTarget {
  diagramId: number;
  projectId: number;
  projectName: string;
  teamId: number;
  teamName: string;
}

interface BrowserDiagnostics {
  issues: string[];
}

/**
 * 인증된 JSON API 요청을 수행한다.
 *
 * @param request Playwright API request context
 * @param method HTTP 메서드
 * @param url 요청 URL
 * @param token Bearer 토큰
 * @param body 요청 본문
 * @returns JSON 응답 또는 204의 경우 undefined
 */
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

/**
 * 테스트용 사용자를 회원가입한다.
 *
 * @param request Playwright API request context
 * @param apiBaseUrl 백엔드 API base URL
 * @param suffix 고유 suffix
 * @param label 사용자 라벨
 * @returns 생성된 사용자 인증 정보
 */
async function signupUser(
  request: APIRequestContext,
  apiBaseUrl: string,
  suffix: string,
  label: string,
): Promise<ProvisionedUser> {
  const loginId = `e2e-md-${label}-${suffix}@example.com`;
  const password = `E2E-${label}-${suffix}`;
  const signup = await request.post(`${apiBaseUrl}/auth/signup`, {
    headers: {
      'Accept-Language': 'ko',
      'Content-Type': 'application/json',
    },
    data: {
      loginId,
      password,
      name: `Markdown ${label} ${suffix}`,
    },
  });

  if (!signup.ok()) {
    throw new Error(`Signup failed ${signup.status()} for ${loginId}`);
  }

  const json = (await signup.json()) as SignupResponse;
  return {
    accessToken: json.accessToken,
    loginId,
    password,
  };
}

/**
 * 팀에 멤버를 초대한다.
 *
 * @param request Playwright API request context
 * @param apiBaseUrl 백엔드 API base URL
 * @param ownerToken owner 토큰
 * @param teamId 팀 ID
 * @param loginId 초대할 로그인 ID
 * @returns 없음
 */
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

/**
 * markdown 협업용 fixture를 생성한다.
 *
 * @param request Playwright API request context
 * @param apiBaseUrl 백엔드 API base URL
 * @param suffix 고유 suffix
 * @returns owner 계정과 대상 문서 정보
 */
async function provisionMarkdownFixture(
  request: APIRequestContext,
  apiBaseUrl: string,
  suffix: string,
): Promise<{ owner: ProvisionedUser; target: MarkdownTarget }> {
  const owner = await signupUser(request, apiBaseUrl, suffix, 'owner');
  const team = await apiJson<TeamSummary>(
    request,
    'POST',
    `${apiBaseUrl}/teams`,
    owner.accessToken,
    { name: `Markdown Team ${suffix}` },
  );
  const project = await apiJson<ProjectSummary>(
    request,
    'POST',
    `${apiBaseUrl}/teams/${team.id}/projects`,
    owner.accessToken,
    { name: `Markdown Project ${suffix}` },
  );
  const document = await apiJson<DocumentSummary>(
    request,
    'POST',
    `${apiBaseUrl}/teams/${team.id}/projects/${project.id}/diagrams`,
    owner.accessToken,
    {
      name: `Markdown Collab ${suffix}`,
      pluginId: 'markdown',
      templateKey: 'meeting-notes',
    },
  );

  return {
    owner,
    target: {
      diagramId: document.id,
      projectId: project.id,
      projectName: project.name,
      teamId: team.id,
      teamName: team.name,
    },
  };
}

/**
 * 멤버 계정이 문서 detail/bootstrap에 접근 가능한지 확인한다.
 *
 * @param request Playwright API request context
 * @param apiBaseUrl 백엔드 API base URL
 * @param token 멤버 액세스 토큰
 * @param target 대상 문서 정보
 * @returns 없음
 */
async function assertDocumentAccess(
  request: APIRequestContext,
  apiBaseUrl: string,
  token: string,
  target: MarkdownTarget,
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
  expect(detail.pluginId).toBe('markdown');
  expect(bootstrap.pluginId).toBe('markdown');
  expect(bootstrap.engineId).toBe('yjs');
}

/**
 * 문서 편집 URL을 구성한다.
 *
 * @param baseUrl 프런트 base URL
 * @param target 대상 문서 정보
 * @returns 절대 URL
 */
function markdownDocumentUrl(baseUrl: string, target: MarkdownTarget): string {
  return `${baseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`;
}

/**
 * 브라우저 컨텍스트에 로그인하고 markdown 문서를 연다.
 *
 * @param context 브라우저 컨텍스트
 * @param baseConfig 공통 E2E 설정
 * @param loginId 로그인 ID
 * @param password 비밀번호
 * @param target 대상 문서 정보
 * @returns 열린 페이지
 */
async function openMarkdownSession(
  context: BrowserContext,
  baseConfig: ReturnType<typeof getE2EProvisioningConfig>,
  loginId: string,
  password: string,
  target: MarkdownTarget,
): Promise<Page> {
  const page = await context.newPage();
  await loginViaUi(page, {
    ...baseConfig,
    loginId,
    password,
  });
  await page.goto(markdownDocumentUrl(baseConfig.baseUrl, target), {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    page.getByRole('button', { name: /문서 허브로|back to documents|documents hub/i }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForFunction(
    () => Boolean(window.monaco?.editor?.getModels?.().length),
    undefined,
    { timeout: 30_000 },
  );
  await expect(page.getByRole('button', { name: /저장|save/i })).toBeVisible();
  return page;
}

/**
 * Monaco 모델 값을 읽는다.
 *
 * @param page Playwright 페이지
 * @returns 현재 markdown 버퍼
 */
async function readMarkdownBuffer(page: Page): Promise<string> {
  return page.evaluate(() => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) {
      throw new Error('Monaco model not found');
    }
    return model.getValue();
  });
}

/**
 * Monaco 모델 끝에 새 줄을 추가한다.
 *
 * @param page Playwright 페이지
 * @param line 추가할 라인
 * @returns 업데이트 후 버퍼
 */
async function appendMarkdownLine(page: Page, line: string): Promise<string> {
  return page.evaluate((nextLine) => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) {
      throw new Error('Monaco model not found');
    }
    const current = model.getValue();
    const next = `${current.trimEnd()}\n${nextLine}\n`;
    model.setValue(next);
    return next;
  }, line);
}

/**
 * 페이지의 Monaco 버퍼에 특정 문자열이 나타날 때까지 기다린다.
 *
 * @param page Playwright 페이지
 * @param fragment 기대 문자열
 * @returns 없음
 */
async function waitForMarkdownFragment(page: Page, fragment: string): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const model = window.monaco?.editor?.getModels?.()[0];
      return model?.getValue().includes(expected) ?? false;
    },
    fragment,
    { timeout: PROPAGATION_TIMEOUT_MS },
  );
}

/**
 * 브라우저 콘솔/페이지 에러를 수집한다.
 *
 * @param page Playwright 페이지
 * @param label 세션 라벨
 * @returns 수집 객체
 */
function attachDiagnostics(page: Page, label: string): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = { issues: [] };
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) {
      return;
    }
    const entry = `[browser:${label}:${message.type()}] ${message.text()}`;
    diagnostics.issues.push(entry);
    console.log(entry);
  });
  page.on('pageerror', (error) => {
    const entry = `[browser:${label}:pageerror] ${error.message}`;
    diagnostics.issues.push(entry);
    console.log(entry);
  });
  return diagnostics;
}

/**
 * 협업 중 발생한 브라우저 이슈가 없는지 확인한다.
 *
 * @param diagnostics 수집된 진단 정보 목록
 * @returns 없음
 */
function assertNoBrowserIssues(...diagnostics: BrowserDiagnostics[]): void {
  const issues = diagnostics.flatMap((entry) => entry.issues);
  if (issues.length > 0) {
    throw new Error(`Unexpected browser issues:\n${issues.join('\n')}`);
  }
}

test('three separate accounts collaborate on one markdown document @smoke', async ({
  browser,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fixture = await provisionMarkdownFixture(request, config.apiBaseUrl, suffix);

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
    const ownerPage = await openMarkdownSession(
      ownerContext,
      config,
      fixture.owner.loginId,
      fixture.owner.password,
      fixture.target,
    );
    const memberOnePage = await openMarkdownSession(
      memberOneContext,
      config,
      memberOne.loginId,
      memberOne.password,
      fixture.target,
    );
    const memberTwoPage = await openMarkdownSession(
      memberTwoContext,
      config,
      memberTwo.loginId,
      memberTwo.password,
      fixture.target,
    );

    const ownerDiagnostics = attachDiagnostics(ownerPage, 'owner');
    const memberOneDiagnostics = attachDiagnostics(memberOnePage, 'member-one');
    const memberTwoDiagnostics = attachDiagnostics(memberTwoPage, 'member-two');

    const ownerLine = `- Owner sync ${suffix}`;
    const memberOneLine = `- Member one sync ${suffix}`;
    const memberTwoLine = `- Member two sync ${suffix}`;

    await appendMarkdownLine(ownerPage, ownerLine);
    await waitForMarkdownFragment(memberOnePage, ownerLine);
    await waitForMarkdownFragment(memberTwoPage, ownerLine);

    await appendMarkdownLine(memberOnePage, memberOneLine);
    await waitForMarkdownFragment(ownerPage, memberOneLine);
    await waitForMarkdownFragment(memberTwoPage, memberOneLine);

    await appendMarkdownLine(memberTwoPage, memberTwoLine);
    await waitForMarkdownFragment(ownerPage, memberTwoLine);
    await waitForMarkdownFragment(memberOnePage, memberTwoLine);

    await ownerPage.getByRole('button', { name: /저장|save/i }).click();
    await expect(ownerPage.getByText(/저장됨|saved/i)).toBeVisible({ timeout: 10_000 });

    const persistedContent = await apiJson<{ content: string }>(
      request,
      'GET',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
      fixture.owner.accessToken,
    );

    expect(persistedContent.content).toContain(ownerLine);
    expect(persistedContent.content).toContain(memberOneLine);
    expect(persistedContent.content).toContain(memberTwoLine);

    expect(await readMarkdownBuffer(ownerPage)).toContain(memberTwoLine);
    expect(await readMarkdownBuffer(memberOnePage)).toContain(ownerLine);
    expect(await readMarkdownBuffer(memberTwoPage)).toContain(memberOneLine);

    assertNoBrowserIssues(ownerDiagnostics, memberOneDiagnostics, memberTwoDiagnostics);
  } finally {
    await ownerContext.close();
    await memberOneContext.close();
    await memberTwoContext.close();
  }
});
