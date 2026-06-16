import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
  waitForMonacoModelValueContains,
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

async function switchWorkMode(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('combobox', { name: /작업 모드|work mode/i }).click();
  await page.getByRole('option', { name: label }).click();
}

async function seedDslEditor(page: Page, text: string): Promise<void> {
  await page.evaluate((nextText) => {
    const editor = window.monaco?.editor?.getEditors?.()[0];
    const model = editor?.getModel();
    if (!editor || !model) {
      throw new Error('Monaco editor not found');
    }

    model.setValue(nextText);
    const lineNumber = model.getLineCount();
    const column = model.getLineMaxColumn(lineNumber);
    editor.setPosition({ lineNumber, column });
    editor.focus();
  }, text);
}

async function provisionDictionaryTerms(
  request: APIRequestContext,
  apiBaseUrl: string,
  teamId: number,
  token: string,
): Promise<void> {
  const dictionarySets = await apiJson<DictionarySetSummary[]>(
    request,
    'GET',
    `${apiBaseUrl}/teams/${teamId}/dictionary-sets`,
    token,
  );
  const dictionarySetId =
    dictionarySets.find((candidate) => candidate.isDefault)?.id ?? dictionarySets[0]?.id;
  if (!dictionarySetId) {
    throw new Error('Dictionary set was not provisioned');
  }

  for (const word of [
    { logicalName: '사용자', physicalName: 'user' },
    { logicalName: '식별자', physicalName: 'id' },
    { logicalName: '주문', physicalName: 'order' },
  ]) {
    await apiJson(
      request,
      'POST',
      `${apiBaseUrl}/teams/${teamId}/dictionary-sets/${dictionarySetId}/words`,
      token,
      word,
    );
  }

  for (const term of [
    { logicalName: '사용자', physicalName: 'user' },
    { logicalName: '사용자 식별자', physicalName: 'user_id' },
    { logicalName: '주문', physicalName: 'order' },
  ]) {
    await apiJson(
      request,
      'POST',
      `${apiBaseUrl}/teams/${teamId}/dictionary-sets/${dictionarySetId}/terms`,
      token,
      term,
    );
  }
}

test('code-first DSL autocomplete opens via Ctrl+Space and idle typing @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const token = await loginViaUi(page, { ...config, ...fixture });

  await provisionDictionaryTerms(request, config.apiBaseUrl, fixture.target.teamId, token);

  await apiJson<void>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
    token,
    {
      content: JSON.stringify({
        nodes: [
          {
            id: 'table-users',
            type: 'table',
            position: { x: 180, y: 120 },
            data: {
              label: 'users',
              logicalTableName: '사용자',
              columns: [
                {
                  id: 'col-users-id',
                  logicalName: '사용자 식별자',
                  name: 'user_id',
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
  await switchWorkMode(page, /코드 우선|code-first/i);
  await waitForMonacoModelValueContains(page, 'Table');

  await seedDslEditor(page, 'Table 사');
  await page.keyboard.press('Control+Space');

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole('option', { name: /사용자/ })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(listbox).toHaveCount(0);

  await seedDslEditor(page, 'Table ');
  await page.keyboard.type('사');

  await expect(listbox).toBeVisible({ timeout: 2_500 });
  await expect(page.getByRole('option', { name: /사용자/ })).toBeVisible();

  await page.waitForTimeout(400);
  await expect(listbox).toBeVisible();
});
