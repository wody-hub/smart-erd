import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  getNodeModelPosition,
  loginViaUi,
  openCodeEditor,
  provisionCollaborationFixture,
  waitForMonacoModelValueContains,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

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

test('code auto apply preserves existing layout and appends new table @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) {
    throw new Error('Access token not found after login');
  }

  const dictionarySets = await apiJson<DictionarySetSummary[]>(
    request,
    'GET',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets`,
    token,
  );
  const dictionarySetId =
    dictionarySets.find((candidate) => candidate.isDefault)?.id ?? dictionarySets[0]?.id;

  if (!dictionarySetId) {
    throw new Error('Dictionary set was not provisioned');
  }

  for (const word of [
    { logicalName: 'users', physicalName: 'users' },
    { logicalName: 'id', physicalName: 'id' },
    { logicalName: 'invoices', physicalName: 'invoices' },
    { logicalName: 'invoice_id', physicalName: 'invoice_id' },
  ]) {
    await apiJson(
      request,
      'POST',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/words`,
      token,
      word,
    );
  }

  for (const term of [
    { logicalName: 'users', physicalName: 'users' },
    { logicalName: 'id', physicalName: 'id' },
    { logicalName: 'invoices', physicalName: 'invoices' },
    { logicalName: 'invoice_id', physicalName: 'invoice_id' },
  ]) {
    await apiJson(
      request,
      'POST',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/terms`,
      token,
      term,
    );
  }

  await apiJson<void>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
    token,
    {
      content: JSON.stringify({
        nodes: [
          {
            id: 'table-1',
            type: 'table',
            position: { x: 760, y: 340 },
            data: {
              label: 'users',
              columns: [
                {
                  id: 'col-1',
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
      }),
    },
  );

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  const usersNode = page.locator('.react-flow__node-table', { hasText: 'users' }).first();
  await expect(usersNode).toBeVisible();
  const beforePosition = await getNodeModelPosition(usersNode);

  await openCodeEditor(page);
  await waitForMonacoModelValueContains(page, 'Table users {');

  await page.evaluate(() => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) {
      throw new Error('Monaco model not found');
    }
    model.setValue('Table users {\n  id\n}\n\nTable invoices {\n  invoice_id\n}');
  });

  const invoicesNode = page.locator('.react-flow__node-table', { hasText: 'invoices' }).first();
  await expect(invoicesNode).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(async () => page.locator('.react-flow__node-table').count(), { timeout: 20_000 })
    .toBe(2);

  const afterUsersPosition = await getNodeModelPosition(usersNode);
  const invoicesPosition = await getNodeModelPosition(invoicesNode);

  expect(Math.abs(afterUsersPosition.x - beforePosition.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(afterUsersPosition.y - beforePosition.y)).toBeLessThanOrEqual(5);
  expect(invoicesPosition.x).toBeGreaterThan(afterUsersPosition.x);
});

test('quick term domain dropdown focuses search input on open @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  const token = await loginViaUi(page, { ...config, ...fixture });
  const dictionarySets = await apiJson<DictionarySetSummary[]>(
    request,
    'GET',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets`,
    token,
  );
  const dictionarySetId =
    dictionarySets.find((candidate) => candidate.isDefault)?.id ?? dictionarySets[0]?.id;

  if (!dictionarySetId) {
    throw new Error('Dictionary set was not provisioned');
  }

  await apiJson(
    request,
    'POST',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/domains`,
    token,
    {
      logicalName: '검색도메인',
      physicalType: 'VARCHAR(64)',
      description: 'focus domain',
    },
  );

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  await openCodeEditor(page);

  await page.evaluate(() => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) {
      throw new Error('Monaco model not found');
    }
    model.setValue('Table 사용자 {\n  신규컬럼\n}');
  });

  const errorGuideButton = page.getByRole('button', {
    name: /DSL 오류 가이드 열기|Open DSL error guide/i,
  });
  await expect(errorGuideButton).toContainText('2');
  await errorGuideButton.click();

  await page
    .getByRole('button', {
      name: /용어 등록|Register term/i,
    })
    .first()
    .click();

  await page.getByRole('combobox', { name: /도메인|domain/i }).click();
  await expect(page.locator('[cmdk-input]')).toBeFocused();
});
