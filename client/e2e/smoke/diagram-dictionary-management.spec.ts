import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

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

interface DictionarySetSummary {
  id: number;
  isDefault: boolean;
}

test('diagram dictionary management dialog scrolls and prioritizes logical-name matches @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const token = await loginViaUi(page, { ...config, ...fixture });
  await page.setViewportSize({ width: 1280, height: 560 });
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

  const words = [
    {
      logicalName: 'customer name',
      physicalName: 'customer_name',
      description: 'customer logical match '.repeat(8),
    },
    {
      logicalName: 'order',
      physicalName: 'customer_order',
      description: 'customer physical match '.repeat(8),
    },
    { logicalName: 'status', physicalName: 'status_code', description: 'status row '.repeat(8) },
    ...Array.from({ length: 32 }, (_, index) => ({
      logicalName: `sample ${index + 1}`,
      physicalName: `sample_${index + 1}`,
      description: `sample description ${index + 1} `.repeat(8),
    })),
  ];

  for (const word of words) {
    await apiJson(
      request,
      'POST',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/words`,
      token,
      word,
    );
  }

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  await page.getByRole('button', { name: /Dictionary|사전/i }).click();

  const dialog = page.getByRole('dialog');
  const body = page.getByTestId('dictionary-management-body');
  await expect(dialog).toBeVisible();
  await expect(body).toBeVisible();

  const scrollable = await body.evaluate((element) => element.scrollHeight > element.clientHeight);
  expect(scrollable).toBe(true);

  await body.evaluate((element) => {
    element.scrollTop = 0;
  });
  await body.hover();
  await page.mouse.wheel(0, 1200);
  await expect
    .poll(() => body.evaluate((element) => element.scrollTop), { timeout: 5_000 })
    .toBeGreaterThan(0);

  const searchInput = dialog.getByRole('textbox', { name: /word|단어/i });
  await searchInput.fill('customer');

  const firstRowLogicalName = dialog.locator('tbody tr').first().locator('td').first();
  await expect(firstRowLogicalName).toHaveText('customer name');
});
