import { expect, test } from '@playwright/test';
import {
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
} from '../shared/diagram-e2e';

interface WbsItemSummary {
  id: number;
  parentId: number | null;
  name: string;
  depth: number;
  sortOrder: number;
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

async function apiGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'ko',
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

test('RIS-318: dedicated WBS page structure authoring regression check', async ({ page }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config, { pluginId: 'erd' });
  const token = await loginViaUi(page, { ...config, ...fixture });
  const { teamId, projectId } = fixture.target;

  const rootA = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { name: '기획' },
  );
  const rootB = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { name: '개발' },
  );
  const childB = await apiPost<WbsItemSummary>(
    `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
    token,
    { name: '개발-하위', parentId: rootB.id },
  );

  await page.goto(`${config.baseUrl}/teams/${teamId}/projects/${projectId}/wbs`, {
    waitUntil: 'networkidle',
  });

  const rowByName = (name: string) => page.locator('tr', { has: page.getByText(name, { exact: true }) });

  await expect(rowByName('기획')).toBeVisible();
  await expect(rowByName('개발')).toBeVisible();
  await expect(rowByName('개발-하위')).toBeVisible();

  // dedicated action strip: icon-only button + tooltip label/description
  const addBelowButton = rowByName('기획').getByRole('button', { name: /아래 추가|Add below/i });
  await expect(addBelowButton).toHaveText('');
  await addBelowButton.hover();
  await expect(page.getByRole('tooltip').getByText(/아래 추가|Add below/i)).toBeVisible();
  await expect(
    page.getByRole('tooltip').getByText(/같은 레벨|sibling directly after/i),
  ).toBeVisible();

  // sibling-below add
  await rowByName('기획').getByRole('button', { name: /아래 추가|Add below/i }).click();
  await page.getByRole('button', { name: /같은 레벨 아래 추가|Add item below/i }).click();
  const siblingInput = page.getByRole('textbox', { name: /같은 레벨 아래 추가|Add item below/i });
  await siblingInput.fill('기획-아래');
  await siblingInput
    .locator('xpath=ancestor::tr')
    .getByRole('button', { name: /^추가$|^Add$/i })
    .click();
  await expect(rowByName('기획-아래')).toBeVisible();

  // child add
  await rowByName('개발').getByRole('button', { name: /하위 추가|Add child/i }).click();
  await page.getByRole('button', { name: /하위 항목 추가|Add sub-item/i }).click();
  const childInput = page.getByRole('textbox', { name: /하위 항목 추가|Add sub-item/i });
  await childInput.fill('개발-하위-2');
  await childInput.locator('xpath=ancestor::tr').getByRole('button', { name: /^추가$|^Add$/i }).click();
  await expect(rowByName('개발-하위-2')).toBeVisible();

  // structure preset policy: progress column is hidden by default.
  await expect(page.getByRole('columnheader', { name: /진행|Progress/i })).toHaveCount(0);
  await page.getByRole('button', { name: /컬럼|Columns/i }).click();
  await page.getByRole('menuitemcheckbox', { name: /^진행$|^Progress$/i }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader', { name: /진행|Progress/i })).toBeVisible();

  // inline edit regression (progress inline editor after column visibility opt-in)
  await rowByName('기획').getByRole('button', { name: /0%/ }).click();
  const inlineProgressInput = rowByName('기획').locator('input[type=\"number\"]').first();
  await inlineProgressInput.fill('15');
  await inlineProgressInput.press('Enter');
  await expect(rowByName('기획')).toContainText('15%');

  // structural move: outdent then indent
  await rowByName('개발-하위').getByRole('button', { name: /내어쓰기|Outdent/i }).click();
  await expect
    .poll(async () => {
      const items = await apiGet<WbsItemSummary[]>(
        `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
        token,
      );
      const movedItem = items.find((item) => item.id === childB.id);
      return movedItem ? movedItem.parentId : 'missing';
    })
    .toBeNull();

  await rowByName('개발-하위').getByRole('button', { name: /들여쓰기|Indent/i }).click();
  await expect
    .poll(async () => {
      const items = await apiGet<WbsItemSummary[]>(
        `${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`,
        token,
      );
      const movedItem = items.find((item) => item.id === childB.id);
      return movedItem ? movedItem.parentId : 'missing';
    })
    .toBe(rootB.id);

  // guard: first sibling move-up disabled
  const maybeTopRow = rowByName('기획');
  await expect(maybeTopRow.getByRole('button', { name: /위로 이동|Move up/i })).toBeDisabled();
});
