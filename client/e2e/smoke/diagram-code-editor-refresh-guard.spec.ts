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

async function apiJson<T>(
  request: APIRequestContext,
  method: 'PUT',
  url: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const response = await request.put(url, {
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

test('code editor refresh confirms only when the draft is dirty @smoke', async ({
  browser,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    const token = await loginViaUi(page, { ...config, ...fixture });

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

    await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(page, fixture.target);
    await waitForEditableDiagram(page, 30_000);
    await switchWorkMode(page, /코드 우선|code-first/i);
    await waitForMonacoModelValueContains(page, 'Table users {');

    const refreshDialog = page.getByRole('dialog', { name: /코드 새로고침|refresh code/i });
    const refreshButton = page.getByRole('button', { name: /ERD에서 새로고침|refresh from erd/i });
    await refreshButton.evaluate((node: HTMLElement) => node.click());
    await expect(refreshDialog).toHaveCount(0);

    await page.evaluate(() => {
      const monaco = window.monaco;
      const editor = monaco?.editor?.getEditors?.()[0];
      const model = editor?.getModel();
      if (!monaco || !editor || !model) {
        throw new Error('Monaco editor not found');
      }
      const lastLine = model.getLineCount();
      const lastColumn = model.getLineMaxColumn(lastLine);
      editor.setPosition({ lineNumber: lastLine, column: lastColumn });
      editor.focus();
    });
    await page.keyboard.type('\n\nTable orders {\n  order_id\n}');
    await waitForMonacoModelValueContains(page, 'Table orders {');
    await expect(page.getByText(/자동 반영 대기중|waiting for auto-apply/i)).toBeVisible({
      timeout: 15_000,
    });

    await refreshButton.evaluate((node: HTMLElement) => node.click());
    await expect(refreshDialog).toBeVisible();
    await expect(
      page.getByText(
        /문법 오류가 있는 현재 편집 내용을 버리고 ERD 기준 코드로 다시 생성합니다|current draft has syntax errors/i,
      ),
    ).toBeVisible();
  } finally {
    await context.close().catch(() => {});
  }
});
