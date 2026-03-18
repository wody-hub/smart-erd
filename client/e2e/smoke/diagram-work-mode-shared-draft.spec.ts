import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  diagramUrl,
  dragNodeToModelPosition,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  getNodeModelPosition,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

const PROPAGATION_TIMEOUT_MS = 20_000;

interface DictionarySetSummary {
  id: number;
  isDefault: boolean;
}

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

test('code mode shared draft is visible across sessions and matched node moves persist @smoke', async ({
  browser,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

    const ownerContext = await browser.newContext();
    const peerContext = await browser.newContext();

  try {
    const ownerPage = await ownerContext.newPage();
    const peerPage = await peerContext.newPage();

    const ownerToken = await loginViaUi(ownerPage, { ...config, ...fixture });
    await loginViaUi(peerPage, { ...config, ...fixture });

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
      {
        content: JSON.stringify(initialContent),
      },
    );

    const targetUrl = diagramUrl(config, fixture.target);
    await ownerPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await peerPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(ownerPage, fixture.target);
    await expectDiagramHeaderVisible(peerPage, fixture.target);
    await waitForEditableDiagram(ownerPage, 30_000);
    await waitForEditableDiagram(peerPage, 30_000);

    await switchWorkMode(ownerPage, /코드 우선|code-first/i);

    await ownerPage.waitForFunction(
      () => Boolean(window.monaco?.editor?.getModels?.().length),
      undefined,
      { timeout: 15_000 },
    );
    await ownerPage.waitForFunction(
      () => {
        const model = window.monaco?.editor?.getModels?.()[0];
        return model?.getValue().includes('Table users {') ?? false;
      },
      undefined,
      { timeout: 15_000 },
    );

    await ownerPage.evaluate(() => {
      const model = window.monaco?.editor?.getModels?.()[0];
      if (!model) {
        throw new Error('Monaco model not found');
      }
      model.setValue('Table users {\n  id\n}\n\nTable orders {\n  order_id\n}');
    });

    await expect(
      ownerPage.locator('.react-flow__node-previewTable', { hasText: 'orders' }),
    ).toHaveCount(1, { timeout: PROPAGATION_TIMEOUT_MS });

    await expect(
      peerPage.locator('.react-flow__node-previewTable', { hasText: 'orders' }),
    ).toHaveCount(1, { timeout: PROPAGATION_TIMEOUT_MS });

    const ownerUsersNode = ownerPage.locator('.react-flow__node-previewTable', { hasText: 'users' }).first();
    const peerUsersNode = peerPage.locator('.react-flow__node-table', { hasText: 'users' }).first();

    await expect(ownerUsersNode).toBeVisible();
    await expect(peerUsersNode).toBeVisible();

    const beforePeerPosition = await getNodeModelPosition(peerUsersNode);
    const targetPosition = { x: beforePeerPosition.x + 220, y: beforePeerPosition.y + 80 };

    await dragNodeToModelPosition(ownerPage, ownerUsersNode, targetPosition);

    await expect
      .poll(
        async () => {
          const position = await getNodeModelPosition(peerUsersNode);
          return (
            Math.abs(position.x - targetPosition.x) <= 8 &&
            Math.abs(position.y - targetPosition.y) <= 8
          );
        },
        {
          timeout: PROPAGATION_TIMEOUT_MS,
        },
      )
      .toBe(true);

    await ownerPage.getByRole('button', { name: /ERD 적용|Apply to ERD/i }).click();
    const applyConfirmDialog = ownerPage.getByRole('dialog', { name: /ERD 교체|Replace ERD/i });
    await expect(applyConfirmDialog).toBeVisible();
    await applyConfirmDialog.getByRole('button', { name: /삭제|Delete/i }).click();

    await expect(
      peerPage.locator('.react-flow__node-table', { hasText: 'orders' }),
    ).toHaveCount(1, { timeout: PROPAGATION_TIMEOUT_MS });

    await expect(
      peerPage.locator('.react-flow__node-previewTable', { hasText: 'orders' }),
    ).toHaveCount(0, {
      timeout: PROPAGATION_TIMEOUT_MS,
    });
  } finally {
    await ownerContext.close();
    await peerContext.close();
  }
});

test('code mode draft survives session restart via Y.Doc snapshot @smoke', async ({
  browser,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  const firstContext = await browser.newContext();

  try {
    const firstPage = await firstContext.newPage();
    const ownerToken = await loginViaUi(firstPage, { ...config, ...fixture });

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
      {
        content: JSON.stringify(initialContent),
      },
    );

    const targetUrl = diagramUrl(config, fixture.target);
    await firstPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(firstPage, fixture.target);
    await waitForEditableDiagram(firstPage, 30_000);
    await switchWorkMode(firstPage, /코드 우선|code-first/i);

    await firstPage.waitForFunction(
      () => Boolean(window.monaco?.editor?.getModels?.().length),
      undefined,
      { timeout: 15_000 },
    );

    await firstPage.evaluate(() => {
      const model = window.monaco?.editor?.getModels?.()[0];
      if (!model) {
        throw new Error('Monaco model not found');
      }
      model.setValue('Table users {\n  id\n}\n\nTable orders {\n  order_id\n}');
    });

    await firstPage.waitForTimeout(350);
  } finally {
    await firstContext.close();
  }

  const secondContext = await browser.newContext();
  try {
    const secondPage = await secondContext.newPage();
    await loginViaUi(secondPage, { ...config, ...fixture });

    const targetUrl = diagramUrl(config, fixture.target);
    await secondPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(secondPage, fixture.target);
    await waitForEditableDiagram(secondPage, 30_000);
    await switchWorkMode(secondPage, /코드 우선|code-first/i);

    await secondPage.waitForFunction(
      () => Boolean(window.monaco?.editor?.getModels?.().length),
      undefined,
      { timeout: 15_000 },
    );
    await secondPage.waitForFunction(
      () => {
        const model = window.monaco?.editor?.getModels?.()[0];
        return model?.getValue().includes('Table orders {') ?? false;
      },
      undefined,
      { timeout: PROPAGATION_TIMEOUT_MS },
    );

    await expect(
      secondPage.locator('.react-flow__node-previewTable', { hasText: 'orders' }),
    ).toHaveCount(1, { timeout: PROPAGATION_TIMEOUT_MS });
  } finally {
    await secondContext.close();
  }
});
