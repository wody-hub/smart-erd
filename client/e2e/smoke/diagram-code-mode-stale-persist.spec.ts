import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  clickBackupAndWaitForPersistedDiagramSave,
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

test('code mode stale snapshot persist blocks apply and finalize until reload @smoke', async ({
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
      { logicalName: 'status', physicalName: 'status' },
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
      { logicalName: 'status', physicalName: 'status' },
    ]) {
      await apiJson(
        request,
        'POST',
        `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/terms`,
        ownerToken,
        term,
      );
    }

    await apiJson<void>(
      request,
      'PUT',
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
      ownerToken,
      {
        content: JSON.stringify({
          nodes: [
            {
              id: 'table-users',
              type: 'table',
              position: { x: 180, y: 120 },
              data: {
                label: 'users',
                columns: [
                  {
                    id: 'col-users-id',
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

    const targetUrl = diagramUrl(config, fixture.target);
    await ownerPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await peerPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(ownerPage, fixture.target);
    await expectDiagramHeaderVisible(peerPage, fixture.target);
    await waitForEditableDiagram(ownerPage, 30_000);
    await waitForEditableDiagram(peerPage, 30_000);

    await switchWorkMode(ownerPage, /코드 우선|code-first/i);
    await waitForMonacoModelValueContains(ownerPage, 'Table users {');

    await ownerPage.evaluate(() => {
      const model = window.monaco?.editor?.getModels?.()[0];
      if (!model) {
        throw new Error('Monaco model not found');
      }
      model.setValue('Table users {\n  id\n}\n\nTable orders {\n  order_id\n}');
    });

    await expect(
      ownerPage.locator('.react-flow__node-previewTable', { hasText: 'orders' }),
    ).toHaveCount(1, { timeout: 20_000 });

    await peerPage.getByRole('button', { name: /테이블 추가|add table/i }).click();
    await clickBackupAndWaitForPersistedDiagramSave(peerPage, fixture.target);

    await ownerPage.evaluate(() => {
      const model = window.monaco?.editor?.getModels?.()[0];
      if (!model) {
        throw new Error('Monaco model not found');
      }
      model.setValue('Table users {\n  id\n}\n\nTable orders {\n  order_id\n  status\n}');
    });

    await expect(
      ownerPage.getByText(/공유 초안 저장이 보류되었습니다|Shared draft save paused/i),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      ownerPage.getByRole('button', { name: /ERD 적용|Apply to ERD/i }),
    ).toBeDisabled();
    await expect(
      ownerPage.getByRole('button', { name: /최종 저장|Finalize save/i }),
    ).toBeDisabled();

    const refreshButton = ownerPage.getByRole('button', {
      name: /ERD에서 새로고침|refresh from erd/i,
    });
    await refreshButton.evaluate((node: HTMLElement) => node.click());
    const refreshDialog = ownerPage.getByRole('dialog', { name: /코드 새로고침|refresh code/i });
    await expect(
      refreshDialog.getByText(
        /원격 변경을 반영하려면 현재 로컬 편집 내용을 버리고 ERD 기준 코드로 다시 맞춰야 합니다|to reconcile remote changes/i,
      ),
    ).toBeVisible();
    await ownerPage.getByRole('button', { name: /취소|cancel/i }).click();

    await ownerPage.reload({ waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(ownerPage, fixture.target);
    await waitForMonacoModelValueContains(ownerPage, 'Table users {');
    await expect(
      ownerPage.getByText(/공유 초안 저장이 보류되었습니다|Shared draft save paused/i),
    ).toHaveCount(0);
    await expect(
      ownerPage.getByRole('button', { name: /ERD 적용|Apply to ERD/i }),
    ).toBeEnabled();
  } finally {
    await ownerContext.close().catch(() => {});
    await peerContext.close().catch(() => {});
  }
});
