import { expect, test } from '@playwright/test';
import {
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
} from '../shared/diagram-e2e';

interface WbsItemSummary {
  id: number;
  name: string;
}

async function apiPost<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'ko',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

test('RIS-305: WBS hierarchy picker works in create/detail with duplicate branch names', async ({
  page,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config, { pluginId: 'erd' });
  const token = await loginViaUi(page, { ...config, ...fixture });
  const { teamId, projectId } = fixture.target;

  const rootA = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { name: '플랫폼' },
  );
  const backendA = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { parentId: rootA.id, name: '백엔드' },
  );
  await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { parentId: backendA.id, name: 'API' },
  );

  const rootB = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { name: '운영' },
  );
  const backendB = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { parentId: rootB.id, name: '백엔드' },
  );
  await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { parentId: backendB.id, name: 'API' },
  );

  await page.goto(`${config.baseUrl}/teams/${teamId}/projects/${projectId}/diagrams`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('tab', { name: /My Tasks|내 할 일/i }).click();
  await page
    .getByRole('button', { name: /TODO 추가|Add TODO|Create the first TODO/i })
    .first()
    .click();

  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel(/제목|title/i).fill('RIS-305 picker qa todo');

  const createLinkedWbsCombobox = createDialog.getByRole('combobox').last();
  await createLinkedWbsCombobox.click();

  const searchInput = page.getByPlaceholder(/WBS/i);
  await searchInput.fill('API');
  await expect(page.getByText('플랫폼 / 백엔드', { exact: true })).toBeVisible();
  await expect(page.getByText('운영 / 백엔드', { exact: true })).toBeVisible();

  await searchInput.fill('플랫폼 / 백엔드');
  await expect(page.getByText('플랫폼 / 백엔드', { exact: true })).toBeVisible();

  await searchInput.fill('없는경로');
  await expect(page.locator('[cmdk-item]').filter({ hasText: '플랫폼 / 백엔드' })).toHaveCount(0);
  await expect(page.locator('[cmdk-item]').filter({ hasText: '운영 / 백엔드' })).toHaveCount(0);

  await searchInput.fill('플랫폼 / 백엔드');
  await page
    .locator('[cmdk-item]')
    .filter({ hasText: '플랫폼 / 백엔드' })
    .first()
    .click({ force: true });

  await createDialog.getByRole('button', { name: /TODO 추가|Add TODO/i }).click();

  const detailLinkedWbsCombobox = page
    .locator('label', { hasText: /연결 WBS|Linked WBS/i })
    .locator('..')
    .getByRole('combobox')
    .first();

  await expect(detailLinkedWbsCombobox).toContainText('플랫폼 / 백엔드 / API');

  await detailLinkedWbsCombobox.click();
  const detailSearchInput = page.getByPlaceholder(/WBS/i);
  await detailSearchInput.fill('운영 / 백엔드');
  await page
    .locator('[cmdk-item]')
    .filter({ hasText: '운영 / 백엔드' })
    .first()
    .click({ force: true });

  await expect(detailLinkedWbsCombobox).toContainText('운영 / 백엔드 / API');
  await expect(
    page.getByText(/After linking to WBS|WBS에 연결하면/i),
  ).toBeVisible();

  await detailLinkedWbsCombobox.click();
  await page
    .locator('[cmdk-item]')
    .filter({ hasText: /연결 안 함|Not linked/i })
    .first()
    .click({ force: true });

  await expect(detailLinkedWbsCombobox).toContainText(/연결 안 함|Not linked/i);
  await expect(
    page.getByText(/Until this TODO is linked to WBS|WBS에 연결되기 전까지/i),
  ).toBeVisible();
});
