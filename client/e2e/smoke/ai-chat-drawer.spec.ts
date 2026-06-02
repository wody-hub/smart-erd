import { expect, test, type Page } from '@playwright/test';
import {
  diagramUrl,
  getE2EConfig,
  loginViaUi,
  resolveTargetDiagram,
  type DiagramTarget,
} from '../shared/diagram-e2e';

test.skip(
  !process.env.SMART_ERD_E2E_LOGIN || !process.env.SMART_ERD_E2E_PASSWORD,
  'AI chat drawer smoke requires SMART_ERD_E2E_LOGIN and SMART_ERD_E2E_PASSWORD.',
);

async function mockAiChatEndpoints(page: Page, target: DiagramTarget): Promise<void> {
  await page.route('**/api/ai/provider/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'noop',
        availability: 'AVAILABLE',
        message: null,
        checkedAt: '2026-06-02T00:00:00Z',
      }),
    });
  });

  await page.route('**/api/ai/chat', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ANSWER',
        conclusion: `${target.projectName} 지연 이슈를 먼저 확인해야 합니다.`,
        interpretation: 'API 작업의 지연 위험이 가장 큽니다.',
        confirmedFacts: ['지연 이슈 2건', 'WBS 위험 1건'],
        needsConfirmation: [],
        sourceChips: [
          {
            projectName: target.projectName,
            tool: 'issues',
            count: 12,
          },
        ],
        confirmationCandidates: [],
        error: null,
      }),
    });
  });
}

test('AI chat drawer opens globally and keeps context while routes change @smoke', async ({ page }) => {
  const config = getE2EConfig();

  await page.goto(`${config.baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'AI에게 질문' })).toHaveCount(0);

  const token = await loginViaUi(page, config);
  const target = await resolveTargetDiagram(token, config);
  await mockAiChatEndpoints(page, target);

  const trigger = page.getByRole('button', { name: 'AI에게 질문' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.getByRole('dialog', { name: 'AI 업무 질문' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('현재 범위')).toBeVisible();

  await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('현재 범위')).toBeVisible();

  const question = '현재 프로젝트 지연 이슈를 요약해줘';
  await drawer.getByRole('textbox').fill(question);
  await drawer.getByRole('button', { name: '질문 보내기' }).click();

  await expect(drawer.getByText(`${target.projectName} 지연 이슈를 먼저 확인해야 합니다.`)).toBeVisible();
  await expect(drawer.getByText(`${target.projectName} - issues 12`)).toBeVisible();
  await expect(drawer.getByText(/확인된 사실|AI 응답을 만들지 못했습니다/)).toBeVisible();
});
