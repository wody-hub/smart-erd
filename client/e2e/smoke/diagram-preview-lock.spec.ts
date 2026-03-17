import { expect, test } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  captureDiagramReady,
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EConfig,
  loginViaUi,
  resolveTargetDiagram,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

const WS_TICKET_DELAY_MS = 3_000;

test('diagram preview renders before ws sync and unlocks editing afterwards @smoke', async ({
  page,
}) => {
  const config = getE2EConfig();
  const token = await loginViaUi(page, config);
  const target = await resolveTargetDiagram(token, config);

  await page.route('**/api/ws-ticket', async (route) => {
    await delay(WS_TICKET_DELAY_MS);
    await route.continue();
  });

  const result = await captureDiagramReady(page, diagramUrl(config, target));
  await expectDiagramHeaderVisible(page, target);
  await expect(result.node).toBeVisible();

  const backupButton = page.getByRole('button', { name: /백업|backup/i });
  await expect(backupButton).toHaveCount(0);
  await expect(page.getByText(/실시간 동기화 연결 중|real-time sync in progress/i)).toBeVisible();
  await expect(
    page.getByText(
      /미리보기를 먼저 표시했습니다|preview is already visible|편집 잠금|editing locked until sync completes/i,
    ),
  ).toBeVisible();

  const editableBackupButton = await waitForEditableDiagram(page, 30_000);
  await expect(editableBackupButton).toBeVisible();

  test.info().annotations.push(
    { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
    { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
    { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
    { type: 'first-visible-ms', description: String(result.visibleMs) },
    { type: 'ws-ticket-delay-ms', description: String(WS_TICKET_DELAY_MS) },
  );

  expect(result.visibleMs).toBeLessThan(10_000);
});
