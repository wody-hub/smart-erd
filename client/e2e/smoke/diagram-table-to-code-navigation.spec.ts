import { expect, test } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

/**
 * 작업 모드를 전환한다.
 *
 * @param page Playwright 페이지
 * @param label 선택할 모드 라벨
 * @returns 없음
 */
async function switchWorkMode(page: import('@playwright/test').Page, label: RegExp): Promise<void> {
  await page.getByRole('combobox', { name: /작업 모드|work mode/i }).click();
  await page.getByRole('option', { name: label }).click();
}

test('table header code navigation reveals the matching DSL table in sync and code modes @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const token = await loginViaUi(page, { ...config, ...fixture });

  const initialContent = {
    nodes: [
      {
        id: 'table-users',
        type: 'table',
        position: { x: 360, y: 180 },
        data: {
          label: 'users',
          logicalTableName: '사용자',
          columns: [
            {
              id: 'users-id',
              logicalName: '사용자 식별자',
              name: 'user_id',
              type: 'BIGINT',
              nullable: false,
              pk: true,
            },
          ],
        },
      },
      {
        id: 'table-orders',
        type: 'table',
        position: { x: 980, y: 240 },
        data: {
          label: 'orders',
          logicalTableName: '주문',
          columns: [
            {
              id: 'orders-id',
              logicalName: '주문 식별자',
              name: 'order_id',
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

  const updateResponse = await request.put(
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'ko',
        'Content-Type': 'application/json',
      },
      data: {
        content: JSON.stringify(initialContent),
      },
    },
  );
  expect(updateResponse.ok()).toBeTruthy();

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  const resolveDslTargetLine = async () =>
    page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()[0];
      const model = editor?.getModel();
      if (!model) {
        throw new Error('Monaco model not found');
      }
      const lines = model.getValue().split('\n');
      const lineNumber =
        lines.findIndex(
          (line) =>
            line.includes('Table') &&
            (line.includes('주문') || line.includes('orders')),
        ) + 1;
      if (lineNumber <= 0) {
        throw new Error('Target table line not found');
      }
      return lineNumber;
    });

  const persistedOrdersNode = page.locator('.react-flow__node-table', { hasText: 'orders' }).first();
  await expect(persistedOrdersNode).toBeVisible();
  await persistedOrdersNode.hover();
  await persistedOrdersNode
    .getByRole('button', { name: /이 테이블에 해당하는 코드로 이동|go to the code/i })
    .click();

  await page.waitForFunction(() => Boolean(window.monaco?.editor?.getModels?.().length), undefined, {
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => {
      const editor = window.monaco?.editor?.getEditors?.()[0];
      const value = editor?.getModel()?.getValue() ?? '';
      return value.includes('주문') || value.includes('orders');
    },
    undefined,
    { timeout: 15_000 },
  );

  const targetLine = await resolveDslTargetLine();
  await page.waitForFunction(
    (expectedLine) => {
      const editor = window.monaco?.editor?.getEditors?.()[0];
      return editor?.getPosition()?.lineNumber === expectedLine;
    },
    targetLine,
    { timeout: 15_000 },
  );

  await switchWorkMode(page, /코드 우선|code-first/i);
  const previewOrdersNode = page
    .locator('.react-flow__node-previewTable', { hasText: 'orders' })
    .first();
  await expect(previewOrdersNode).toBeVisible();

  await page.evaluate(() => {
    const editor = window.monaco?.editor?.getEditors?.()[0];
    editor?.setPosition({ lineNumber: 1, column: 1 });
    editor?.revealLineInCenter(1);
  });

  await previewOrdersNode.hover();
  await previewOrdersNode
    .getByRole('button', { name: /이 테이블에 해당하는 코드로 이동|go to the code/i })
    .click();

  await page.waitForFunction(
    (expectedLine) => {
      const editor = window.monaco?.editor?.getEditors?.()[0];
      return editor?.getPosition()?.lineNumber === expectedLine;
    },
    targetLine,
    { timeout: 15_000 },
  );
});
