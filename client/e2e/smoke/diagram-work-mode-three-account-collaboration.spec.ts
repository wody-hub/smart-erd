import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  diagramUrl,
  dragNodeByScreenDelta,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  getNodeModelPosition,
  getViewportScale,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

const PROPAGATION_TIMEOUT_MS = 20_000;

interface DictionarySetSummary {
  id: number;
  isDefault: boolean;
}

interface SignupResponse {
  accessToken: string;
}

interface ProvisionedUser {
  loginId: string;
  password: string;
  accessToken: string;
}

type TableNodeKind = 'persisted' | 'preview' | 'ghost';

/**
 * 인증된 API 요청을 수행한다.
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
  method: 'GET' | 'POST' | 'PUT',
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
      : method === 'POST'
        ? await request.post(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Accept-Language': 'ko',
              'Content-Type': 'application/json',
            },
            data: body,
          })
        : await request.put(url, {
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
 * @param label 사용자 표시 라벨
 * @returns 생성된 사용자 인증 정보
 */
async function signupUser(
  request: APIRequestContext,
  apiBaseUrl: string,
  suffix: string,
  label: string,
): Promise<ProvisionedUser> {
  const loginId = `e2e-three-${label}-${suffix}@example.com`;
  const password = `E2E-${label}-${suffix}`;
  const signup = await request.post(`${apiBaseUrl}/auth/signup`, {
    headers: {
      'Accept-Language': 'ko',
      'Content-Type': 'application/json',
    },
    data: {
      loginId,
      password,
      name: `E2E ${label} ${suffix}`,
    },
  });

  if (!signup.ok()) {
    throw new Error(`Signup failed ${signup.status()} for ${loginId}`);
  }

  const json = (await signup.json()) as SignupResponse;
  return {
    loginId,
    password,
    accessToken: json.accessToken,
  };
}

/**
 * 팀에 새 멤버를 추가한다.
 *
 * @param request Playwright API request context
 * @param apiBaseUrl 백엔드 API base URL
 * @param ownerToken 팀 owner 토큰
 * @param teamId 팀 ID
 * @param loginId 초대할 사용자 로그인 ID
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
 * 작업 모드를 전환한다.
 *
 * @param page Playwright 페이지
 * @param label 선택할 모드 라벨
 * @returns 없음
 */
async function switchWorkMode(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('combobox', { name: /작업 모드|work mode/i }).click();
  await page.getByRole('option', { name: label }).click();
}

/**
 * Monaco 모델에 DSL 텍스트를 바로 주입한다.
 *
 * @param page Playwright 페이지
 * @param nextDsl 적용할 DSL 텍스트
 * @returns 없음
 */
async function setDslEditorValue(page: Page, nextDsl: string): Promise<void> {
  await page.waitForFunction(
    () => Boolean(window.monaco?.editor?.getModels?.().length),
    undefined,
    { timeout: 15_000 },
  );

  await page.evaluate((value) => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) {
      throw new Error('Monaco model not found');
    }
    model.setValue(value);
  }, nextDsl);
}

/**
 * 특정 테이블명을 가진 React Flow 노드 wrapper locator를 반환한다.
 *
 * 내부 렌더 타입(className) 대신 안정적인 data 속성을 기준으로 찾는다.
 * persisted/preview 동시 표시 정책이 바뀌어도 selector 변경 범위를 줄이기 위함이다.
 *
 * @param page Playwright 페이지
 * @param name 확인할 테이블명
 * @param kinds 허용할 노드 kind 목록
 * @returns React Flow 노드 wrapper locator
 */
function tableNodeWrappers(page: Page, name: string, kinds: readonly TableNodeKind[]) {
  return page.locator('.react-flow__node').filter({
    has: page.locator(
      kinds
        .map((kind) => `[data-table-node-kind="${kind}"][data-table-name="${name}"]`)
        .join(', '),
    ),
  });
}

function attachBrowserDiagnostics(page: Page, label: string): void {
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'info' &&
      (text.includes('[useYjsCollaboration]') || text.includes('[YjsProvider]'))
    ) {
      console.log(`[browser:${label}:info] ${text}`);
      return;
    }
    if (!['warning', 'error'].includes(message.type())) {
      return;
    }
    console.log(`[browser:${label}:${message.type()}] ${text}`);
  });
  page.on('pageerror', (error) => {
    console.log(`[browser:${label}:pageerror] ${error.message}`);
  });
}

/**
 * 코드 위주 미리보기 또는 persisted 노드 중 하나가 나타날 때까지 기다린다.
 *
 * @param page Playwright 페이지
 * @param name 확인할 테이블명
 * @param kinds 허용할 노드 kind 목록
 * @returns 매칭된 locator
 */
async function waitForAnyTableNode(
  page: Page,
  name: string,
  kinds: readonly TableNodeKind[] = ['persisted', 'preview'],
) {
  const node = tableNodeWrappers(page, name, kinds).first();
  await expect(node).toBeVisible({ timeout: PROPAGATION_TIMEOUT_MS });
  return node;
}

/**
 * 현재 DOM에 존재하는 동일 테이블명 노드 후보들의 모델 좌표를 읽는다.
 *
 * persisted 노드와 draft overlay 노드가 동시에 존재할 수 있으므로,
 * 특정 노드 하나가 아니라 후보 전체를 기준으로 협업 전파를 확인한다.
 * 뷰포트 밖으로 나간 노드도 DOM에는 남아 있으므로, 실사용 카메라 위치와 무관하게
 * 실제 모델 좌표 전파 여부를 검증할 수 있다.
 *
 * @param page Playwright 페이지
 * @param name 확인할 테이블명
 * @param kinds 허용할 노드 kind 목록
 * @returns 후보 노드들의 모델 좌표 목록
 */
async function getTableNodePositions(
  page: Page,
  name: string,
  kinds: readonly TableNodeKind[] = ['persisted', 'preview'],
) {
  return tableNodeWrappers(page, name, kinds).evaluateAll(
    (elements) =>
      elements.flatMap((element) => {
        if (!(element instanceof HTMLElement)) {
          return [];
        }
        const matched = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(element.style.transform);
        if (!matched) {
          return [];
        }
        return [
          {
            x: Number(matched[1]),
            y: Number(matched[2]),
          },
        ];
      }),
  );
}

async function getTableNodeBreakdown(
  page: Page,
  name: string,
  kinds: readonly TableNodeKind[] = ['persisted', 'preview', 'ghost'],
) {
  return tableNodeWrappers(page, name, kinds).evaluateAll((elements) =>
    elements.flatMap((element) => {
      if (!(element instanceof HTMLElement)) {
        return [];
      }
      const matched = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(element.style.transform);
      const marker = element.querySelector<HTMLElement>('[data-table-node-kind][data-table-name]');
      if (!matched || !marker) {
        return [];
      }
      return [
        {
          reactFlowId: element.dataset.id ?? null,
          kind: marker.dataset.tableNodeKind,
          name: marker.dataset.tableName,
          x: Number(matched[1]),
          y: Number(matched[2]),
        },
      ];
    }),
  );
}

async function getCanvasUsersStoreSnapshot(page: Page) {
  return page.evaluate(async () => {
    try {
      const [
        { default: useCanvasStore },
        { readSharedSchemaDraftSnapshot },
        { default: useCollaborationStore },
      ] = await Promise.all([
        import('/src/stores/erd/useCanvasStore.ts'),
        import('/src/lib/shared-schema-draft.ts'),
        import('/src/stores/useCollaborationStore.ts'),
      ]);
      const state = useCanvasStore.getState();
      const collaborationState = useCollaborationStore.getState();
      const usersNode = state.nodes.find((node: { data?: { label?: string } }) => node.data?.label === 'users');
      const tablesMap =
        state.ydoc == null ? null : (state.ydoc as import('yjs').Doc).getMap('tables');
      const usersEntry =
        tablesMap == null
          ? null
          : Array.from(tablesMap.entries()).find(([, table]) => table.get('label') === 'users') ?? null;
      const usersTableMap = usersEntry?.[1] ?? null;
      const rawPosition = usersTableMap?.get('position');
      const sharedDraft =
        state.ydoc == null
          ? null
          : readSharedSchemaDraftSnapshot(state.ydoc as unknown as import('yjs').Doc);
      return {
        connectionStatus: collaborationState.connectionStatus,
        presenceMode: collaborationState.presenceMode,
        usersNode: usersNode
          ? {
              id: usersNode.id,
              type: usersNode.type,
              position: usersNode.position,
            }
          : null,
        sharedDraftPositions: sharedDraft?.positions ?? null,
        sharedDraftSchemaHash: sharedDraft?.schemaHash ?? null,
        usersTable: usersTableMap
          ? {
              id: usersEntry?.[0] ?? null,
              positionX: usersTableMap.get('positionX') ?? null,
              positionY: usersTableMap.get('positionY') ?? null,
              rawPosition:
                rawPosition instanceof Map
                  ? Array.from(rawPosition.entries())
                  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    rawPosition && typeof rawPosition === 'object' && 'entries' in (rawPosition as any)
                    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      Array.from((rawPosition as any).entries?.() ?? [])
                    : rawPosition ?? null,
            }
          : null,
      };
    } catch (error) {
      return { error: String(error) };
    }
  });
}

interface SessionTableExpectation {
  label: string;
  page: Page;
  kinds: readonly TableNodeKind[];
}

/**
 * 지정한 kind의 테이블 노드가 target 위치에 도달한 상태를 기다린다.
 *
 * @param page Playwright 페이지
 * @param name 확인할 테이블명
 * @param targetPosition 기대 위치
 * @param kinds 허용할 노드 kind 목록
 * @returns 없음
 */
async function expectVisibleTableNearPosition(
  page: Page,
  name: string,
  targetPosition: { x: number; y: number },
  kinds: readonly TableNodeKind[] = ['persisted', 'preview'],
) {
  await expect
    .poll(
      async () => {
        const positions = await getTableNodePositions(page, name, kinds);
        return positions.some(
          (position) =>
            Math.abs(position.x - targetPosition.x) <= 8 &&
            Math.abs(position.y - targetPosition.y) <= 8,
        );
      },
      { timeout: PROPAGATION_TIMEOUT_MS },
    )
    .toBe(true);
}

async function waitForTableNearPosition(
  page: Page,
  name: string,
  targetPosition: { x: number; y: number },
  kinds: readonly TableNodeKind[] = ['persisted', 'preview'],
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PROPAGATION_TIMEOUT_MS) {
    const positions = await getTableNodePositions(page, name, kinds);
    if (
      positions.some(
        (position) =>
          Math.abs(position.x - targetPosition.x) <= 8 &&
          Math.abs(position.y - targetPosition.y) <= 8,
      )
    ) {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

async function dragTableNodeOnceToModelPosition(
  page: Page,
  locator: Locator,
  target: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const current = await getNodeModelPosition(locator);
  const scale = await getViewportScale(page);
  await dragNodeByScreenDelta(
    page,
    locator,
    (target.x - current.x) * scale,
    (target.y - current.y) * scale,
  );
  return await getNodeModelPosition(locator);
}

/**
 * 브라우저 컨텍스트에 로그인하고 대상 다이어그램을 연다.
 *
 * @param context 브라우저 컨텍스트
 * @param baseConfig 공통 E2E 설정
 * @param loginId 로그인 ID
 * @param password 비밀번호
 * @param target 대상 다이어그램
 * @returns 열린 페이지와 액세스 토큰
 */
async function openDiagramSession(
  context: BrowserContext,
  baseConfig: ReturnType<typeof getE2EProvisioningConfig>,
  loginId: string,
  password: string,
  target: Parameters<typeof diagramUrl>[1],
): Promise<{ page: Page; token: string }> {
  const page = await context.newPage();
  const token = await loginViaUi(page, {
    ...baseConfig,
    loginId,
    password,
  });
  await page.goto(diagramUrl(baseConfig, target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, target);
  await waitForEditableDiagram(page, 30_000);
  return { page, token };
}

test('three accounts collaborate across code, sync, and erd-only modes @smoke', async ({
  browser,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const ownerContext = await browser.newContext();
  const syncContext = await browser.newContext();
  const erdContext = await browser.newContext();

  try {
    const ownerSession = await openDiagramSession(
      ownerContext,
      config,
      fixture.loginId,
      fixture.password,
      fixture.target,
    );
    const ownerPage = ownerSession.page;
    attachBrowserDiagnostics(ownerPage, 'owner');
    const ownerToken = ownerSession.token;

    const memberOne = await signupUser(request, config.apiBaseUrl, suffix, 'sync');
    const memberTwo = await signupUser(request, config.apiBaseUrl, suffix, 'erd');
    await inviteMemberToTeam(
      request,
      config.apiBaseUrl,
      ownerToken,
      fixture.target.teamId,
      memberOne.loginId,
    );
    await inviteMemberToTeam(
      request,
      config.apiBaseUrl,
      ownerToken,
      fixture.target.teamId,
      memberTwo.loginId,
    );

    const dictionarySets = await apiJson<DictionarySetSummary[]>(
      request,
      'GET',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets`,
      ownerToken,
    );
    const dictionarySetId =
      dictionarySets.find((candidate) => candidate.isDefault)?.id ?? dictionarySets[0]?.id;
    if (!dictionarySetId) {
      throw new Error('Dictionary set was not provisioned');
    }

    for (const word of [
      { logicalName: 'users', physicalName: 'users' },
      { logicalName: 'id', physicalName: 'id' },
      { logicalName: 'orders', physicalName: 'orders' },
      { logicalName: 'order_id', physicalName: 'order_id' },
    ]) {
      await apiJson(
        request,
        'POST',
        `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/words`,
        ownerToken,
        word,
      );
    }

    for (const term of [
      { logicalName: 'users', physicalName: 'users' },
      { logicalName: 'id', physicalName: 'id' },
      { logicalName: 'orders', physicalName: 'orders' },
      { logicalName: 'order_id', physicalName: 'order_id' },
    ]) {
      await apiJson(
        request,
        'POST',
        `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/terms`,
        ownerToken,
        term,
      );
    }

    const initialContent = {
      nodes: [
        {
          id: 'table-users',
          type: 'table',
          position: { x: 640, y: 280 },
          data: {
            label: 'users',
            logicalTableName: 'users',
            columns: [
              {
                id: 'col-id',
                logicalName: 'id',
                name: 'id',
                type: 'BIGINT',
                nullable: false,
                pk: true,
              },
            ],
          },
        },
      ],
      edges: [],
      groups: [],
    };

    await apiJson(
      request,
      'PUT',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
      ownerToken,
      { content: JSON.stringify(initialContent) },
    );

    await ownerPage.reload({ waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(ownerPage, fixture.target);
    await waitForEditableDiagram(ownerPage, 30_000);

    const syncSession = await openDiagramSession(
      syncContext,
      config,
      memberOne.loginId,
      memberOne.password,
      fixture.target,
    );
    const syncPage = syncSession.page;
    attachBrowserDiagnostics(syncPage, 'sync');
    const erdSession = await openDiagramSession(
      erdContext,
      config,
      memberTwo.loginId,
      memberTwo.password,
      fixture.target,
    );
    const erdPage = erdSession.page;
    attachBrowserDiagnostics(erdPage, 'erd');

    await switchWorkMode(ownerPage, /코드 우선|code-first/i);
    await switchWorkMode(erdPage, /ERD 전용|ERD-only/i);

    await ownerPage.waitForFunction(
      () => {
        const model = window.monaco?.editor?.getModels?.()[0];
        return model?.getValue().includes('Table users {') ?? false;
      },
      undefined,
      { timeout: 15_000 },
    );

    await setDslEditorValue(ownerPage, 'Table users {\n  id\n}\n\nTable orders {\n  order_id\n}');

    await expect(tableNodeWrappers(ownerPage, 'orders', ['preview'])).toHaveCount(1, {
      timeout: PROPAGATION_TIMEOUT_MS,
    });

    await waitForAnyTableNode(syncPage, 'orders', ['preview']);
    await waitForAnyTableNode(erdPage, 'orders', ['preview']);

    const ownerUsersNode = tableNodeWrappers(ownerPage, 'users', ['preview']).first();
    const syncUsersNode = tableNodeWrappers(syncPage, 'users', ['persisted']).first();
    const erdUsersNode = tableNodeWrappers(erdPage, 'users', ['persisted']).first();

    await expect(ownerUsersNode).toBeVisible();
    await expect(syncUsersNode).toBeVisible();
    await expect(erdUsersNode).toBeVisible();

    const [beforeSyncPosition] = await getTableNodePositions(syncPage, 'users');
    if (!beforeSyncPosition) {
      throw new Error('Visible users node not found on sync page');
    }
    const targetPosition = { x: beforeSyncPosition.x + 220, y: beforeSyncPosition.y + 80 };

    const actualCodeDragPosition = await dragTableNodeOnceToModelPosition(
      ownerPage,
      ownerUsersNode,
      targetPosition,
    );
    await expectVisibleTableNearPosition(ownerPage, 'users', actualCodeDragPosition, ['preview']);

    for (const { page, kinds } of [
      { page: syncPage, kinds: ['persisted'] as const },
      { page: erdPage, kinds: ['persisted'] as const },
    ]) {
      await expectVisibleTableNearPosition(page, 'users', actualCodeDragPosition, kinds);
    }

    await ownerPage.getByRole('button', { name: /ERD 적용|Apply to ERD/i }).click();
    const applyConfirmDialog = ownerPage.getByRole('dialog', { name: /ERD 교체|Replace ERD/i });
    await expect(applyConfirmDialog).toBeVisible();
    await applyConfirmDialog.getByRole('button', { name: /삭제|Delete/i }).click();

    for (const page of [syncPage, erdPage]) {
      await expect(tableNodeWrappers(page, 'orders', ['persisted'])).toHaveCount(1, {
        timeout: PROPAGATION_TIMEOUT_MS,
      });
      await expect(tableNodeWrappers(page, 'orders', ['preview'])).toHaveCount(0, {
        timeout: PROPAGATION_TIMEOUT_MS,
      });
    }

    const syncPersistedUsersNode = tableNodeWrappers(syncPage, 'users', ['persisted']).first();
    await expect(syncPersistedUsersNode).toBeVisible();

    const beforeSyncUsersDragPosition = await getNodeModelPosition(syncPersistedUsersNode);
    if (!beforeSyncUsersDragPosition) {
      throw new Error('Visible users node not found on sync page after apply');
    }
    const syncDraggedUsersPosition = {
      x: beforeSyncUsersDragPosition.x - 140,
      y: beforeSyncUsersDragPosition.y + 110,
    };

    const actualSyncDragPosition = await dragTableNodeOnceToModelPosition(
      syncPage,
      syncPersistedUsersNode,
      syncDraggedUsersPosition,
    );
    await expectVisibleTableNearPosition(syncPage, 'users', actualSyncDragPosition, ['persisted']);

    for (const { page, kinds } of [
      { page: ownerPage, kinds: ['preview'] as const },
      { page: erdPage, kinds: ['persisted'] as const },
    ]) {
      await expectVisibleTableNearPosition(page, 'users', actualSyncDragPosition, kinds);
    }

    const erdPersistedUsersNode = tableNodeWrappers(erdPage, 'users', ['persisted']).first();
    await expect(erdPersistedUsersNode).toBeVisible();

    const beforeErdUsersDragPosition = await getNodeModelPosition(erdPersistedUsersNode);
    if (!beforeErdUsersDragPosition) {
      throw new Error('Visible users node not found on ERD-only page after sync drag');
    }
    const erdDraggedUsersPosition = {
      x: beforeErdUsersDragPosition.x + 160,
      y: beforeErdUsersDragPosition.y - 70,
    };

    const actualErdDragPosition = await dragTableNodeOnceToModelPosition(
      erdPage,
      erdPersistedUsersNode,
      erdDraggedUsersPosition,
    );
    await expectVisibleTableNearPosition(erdPage, 'users', actualErdDragPosition, ['persisted']);

    for (const { label, page, kinds } of [
      { label: 'owner', page: ownerPage, kinds: ['preview'] as const },
      { label: 'sync', page: syncPage, kinds: ['persisted'] as const },
    ] satisfies readonly SessionTableExpectation[]) {
      const propagated = await waitForTableNearPosition(page, 'users', actualErdDragPosition, kinds);
      if (propagated) {
        continue;
      }

      throw new Error(
        JSON.stringify(
          {
            label,
            target: actualErdDragPosition,
            owner: await getTableNodeBreakdown(ownerPage, 'users'),
            sync: await getTableNodeBreakdown(syncPage, 'users'),
            erd: await getTableNodeBreakdown(erdPage, 'users'),
            ownerStore: await getCanvasUsersStoreSnapshot(ownerPage),
            syncStore: await getCanvasUsersStoreSnapshot(syncPage),
            erdStore: await getCanvasUsersStoreSnapshot(erdPage),
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await ownerContext.close();
    await syncContext.close();
    await erdContext.close();
  }
});
