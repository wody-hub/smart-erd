import { expect, test, type APIRequestContext } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  captureDiagramReady,
  clickBackupAndWaitForPersistedDiagramSave,
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

const WS_TICKET_DELAY_MS = 3_000;

async function putDiagramContent(
  request: APIRequestContext,
  apiBaseUrl: string,
  token: string,
  target: {
    teamId: number;
    projectId: number;
    diagramId: number;
  },
  content: string,
): Promise<void> {
  const response = await request.put(
    `${apiBaseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'ko',
        'Content-Type': 'application/json',
      },
      data: { content },
    },
  );

  if (!response.ok()) {
    throw new Error(`Failed to seed diagram content: ${response.status()}`);
  }
}

test('diagram preview renders before ws sync and unlocks editing afterwards @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const token = await loginViaUi(page, { ...config, ...fixture });
  const target = fixture.target;

  await putDiagramContent(
    request,
    config.apiBaseUrl,
    token,
    target,
    JSON.stringify({
      nodes: [
        {
          id: 'table-preview-lock',
          type: 'table',
          position: { x: 480, y: 240 },
          data: {
            label: 'preview_lock_users',
            columns: [
              {
                id: 'col-preview-lock-id',
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
  );

  await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, target);
  await waitForEditableDiagram(page, 30_000);
  await clickBackupAndWaitForPersistedDiagramSave(page, target);

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
    page.getByText(/미리보기를 먼저 표시했습니다|preview is already visible/i),
  ).toBeVisible();
  await expect(
    page.getByText(/연결 완료 전까지 편집 잠금|editing locked until sync completes/i),
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
